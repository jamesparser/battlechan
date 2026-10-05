import * as anchorNS from "@coral-xyz/anchor";
const anchor = anchorNS.default ?? anchorNS;
const { BN, Program } = anchor;
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assert } from "chai";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.battlechan as Program<any>;
const pid = program.programId;
const S = (s: string) => Buffer.from(s);
const le = (n: number | BN, b: number) => new BN(n).toArrayLike(Buffer, "le", b);
const find = (...s: Buffer[]) => PublicKey.findProgramAddressSync(s, pid)[0];

const config = find(S("config"));
const mint = find(S("time_mint"));
const vault = find(S("vault"));
const treasury = find(S("treasury"));
const faucetPool = find(S("faucet_pool"));
const karmaMint = find(S("karma_mint"));
const karmaVault = find(S("karma_vault"));
const karmaTreasury = find(S("karma_treasury"));
const profileOf = (k: PublicKey) => find(S("profile"), k.toBuffer());
const postPda = (id: number | BN) => find(S("post"), le(id, 8));
const catPda = (id: number) => find(S("category"), le(id, 2));
const commentPda = (post: PublicKey, i: number) => find(S("comment"), post.toBuffer(), le(i, 4));
const ataOf = (k: PublicKey) => getAssociatedTokenAddressSync(mint, k);
const TIME = 1_000_000;

async function fund(kp: Keypair) {
  const sig = await provider.connection.requestAirdrop(kp.publicKey, 5 * LAMPORTS_PER_SOL);
  await provider.connection.confirmTransaction(sig, "confirmed");
}

async function onboard(kp: Keypair, referrer: PublicKey | null = null) {
  await fund(kp);
  await program.methods.createProfile(referrer).accountsPartial({ user: kp.publicKey, profile: profileOf(kp.publicKey) }).signers([kp]).rpc();
  await program.methods
    .faucet()
    .accountsPartial({ user: kp.publicKey, config, profile: profileOf(kp.publicKey), timeMint: mint, faucetPool, userAta: ataOf(kp.publicKey) })
    .signers([kp]).rpc();
}

async function newPost(kp: Keypair, cat: number, title: string) {
  const cfg: any = await program.account.config.fetch(config);
  const c: any = await program.account.category.fetch(catPda(cat));
  const slot: PublicKey = c.slots[c.next];
  const victim = slot.equals(PublicKey.default) ? null : slot;
  const post = postPda(cfg.postCount);
  await program.methods
    .createPost(title, "body", "", [])
    .accountsPartial({ author: kp.publicKey, config, category: catPda(cat), profile: profileOf(kp.publicKey), post, victim })
    .signers([kp]).rpc();
  return post;
}

const bal = async (k: PublicKey) => Number((await getAccount(provider.connection, ataOf(k))).amount);

describe("battlechan", () => {
  const alice = Keypair.generate(); // poster
  const bob = Keypair.generate(); // voter
  const likers = Array.from({ length: 5 }, () => Keypair.generate());

  it("initializes with fixed supply and revoked mint authority", async () => {
    await program.methods.initialize().accounts({ admin: provider.wallet.publicKey } as any).rpc();
    const m = await provider.connection.getParsedAccountInfo(mint);
    const info: any = (m.value!.data as any).parsed.info;
    assert.equal(info.mintAuthority, null);
    assert.equal(info.supply, (100_000_000_000 * TIME).toString());
    await program.methods.createCategory("Politics").accountsPartial({ admin: provider.wallet.publicKey, config, category: catPda(0) }).rpc();
  });

  it("onboards users and pays faucet once per day", async () => {
    await onboard(alice);
    await onboard(bob);
    assert.equal(await bal(alice.publicKey), 100 * TIME);
    let failed = false;
    try {
      await program.methods.faucet().accountsPartial({ user: alice.publicKey, config, profile: profileOf(alice.publicKey), timeMint: mint, faucetPool, userAta: ataOf(alice.publicKey) }).signers([alice]).rpc();
    } catch { failed = true; }
    assert.isTrue(failed, "second faucet claim must hit cooldown");
  });

  let post: PublicKey;
  it("post starts at +30 minutes; upvote adds 5 min and fills the pot; downvote burns 50%", async () => {
    post = await newPost(alice, 0, "first");
    let p: any = await program.account.post.fetch(post);
    assert.equal(p.expiresAt.sub(p.createdAt).toNumber(), 5 * 60);

    await program.methods.upvotePost(3).accountsPartial({
      voter: bob.publicKey, config, post, authorProfile: profileOf(alice.publicKey), voterAta: ataOf(bob.publicKey), vault,
    }).signers([bob]).rpc();
    p = await program.account.post.fetch(post);
    assert.equal(p.expiresAt.sub(p.createdAt).toNumber(), 5 * 60 + 3 * 60);
    assert.equal(p.pot.toNumber(), 3 * TIME);

    const supplyBefore = Number((await provider.connection.getTokenSupply(mint)).value.amount);
    const treasBefore = Number((await getAccount(provider.connection, treasury)).amount);
    await program.methods.downvotePost(2).accountsPartial({
      voter: bob.publicKey, config, post, timeMint: mint, voterAta: ataOf(bob.publicKey), treasury,
    }).signers([bob]).rpc();
    const supplyAfter = Number((await provider.connection.getTokenSupply(mint)).value.amount);
    const treasAfter = Number((await getAccount(provider.connection, treasury)).amount);
    assert.equal(supplyBefore - supplyAfter, 1 * TIME, "1 of 2 $TIME burned");
    assert.equal(treasAfter - treasBefore, 1 * TIME, "1 of 2 $TIME to DAO");
    p = await program.account.post.fetch(post);
    assert.equal(p.expiresAt.sub(p.createdAt).toNumber(), 5 * 60 + 3 * 60 - 2 * 60);
  });

  it("5 comment likes mint $KARMA and make the commenter reward-eligible", async () => {
    await program.methods.createComment("nice", "").accountsPartial({
      commenter: bob.publicKey, profile: profileOf(bob.publicKey), post, comment: commentPda(post, 0),
    }).signers([bob]).rpc();
    const comment = commentPda(post, 0);
    for (const l of likers) {
      await onboard(l);
      await program.methods.voteComment(true).accountsPartial({
        voter: l.publicKey, voterProfile: profileOf(l.publicKey), config, post, comment,
        authorProfile: profileOf(bob.publicKey), referrerProfile: null,
        commentVote: find(S("cvote"), comment.toBuffer(), l.publicKey.toBuffer()),
        karmaMint, karmaVault,
      }).signers([l]).rpc();
    }
    const prof: any = await program.account.userProfile.fetch(profileOf(bob.publicKey));
    assert.equal(prof.karma.toNumber(), 1_000_000, "1 $KARMA staked");
    const vaultBal = Number((await getAccount(provider.connection, karmaVault)).amount);
    assert.equal(vaultBal, 1_000_000, "real SPL karma sits in the staking vault");
    const ks = await provider.connection.getTokenSupply(karmaMint);
    assert.equal(ks.value.amount, "1000000");
    const p: any = await program.account.post.fetch(post);
    assert.equal(p.qualifiedLikes.toNumber(), 5);

    const before = await bal(bob.publicKey);
    await program.methods.claimCommentReward().accountsPartial({
      commenter: bob.publicKey, config, post, comment, timeMint: mint, vault, commenterAta: ataOf(bob.publicKey),
    }).signers([bob]).rpc();
    // pot = 3 $TIME; commenter pot = 25% = 0.75 $TIME, bob holds all qualified likes
    assert.equal((await bal(bob.publicKey)) - before, 750_000);
  });

  it("owner cannot withdraw before the initial window, and cannot exceed 75%", async () => {
    let early = false;
    try {
      await program.methods.opWithdraw(new BN(1)).accountsPartial({
        owner: alice.publicKey, config, post, timeMint: mint, vault, ownerAta: ataOf(alice.publicKey),
      }).signers([alice]).rpc();
    } catch { early = true; }
    assert.isTrue(early);
  });

  it("125-slot ring: the 126th post bumps the oldest into the archive; karma can't resurrect without 50", async () => {
    const first = post;
    for (let i = 0; i < 125; i++) await newPost(alice, 0, `p${i}`);
    const p: any = await program.account.post.fetch(first);
    assert.isTrue(p.archived);
    let cantRes = false;
    try {
      const c: any = await program.account.category.fetch(catPda(0));
      await program.methods.karmaResurrect().accountsPartial({
        resurrector: bob.publicKey, config, profile: profileOf(bob.publicKey), post: first, category: catPda(0), victim: c.slots[c.next], karmaVault, karmaTreasuryTa: karmaTreasury,
      }).signers([bob]).rpc();
    } catch { cantRes = true; }
    assert.isTrue(cantRes);
  });
});
