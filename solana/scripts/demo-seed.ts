/**
 * Seed live demo activity on Solana devnet for Battlechan.
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json \
 *     npx ts-node scripts/demo-seed.ts
 */
import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const seed = (s: string) => Buffer.from(s);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/battlechan.json"), "utf8"));
  const program = new anchor.Program(idl as any, provider) as any;
  const pid = program.programId;
  const find = (...s: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(s, pid)[0];
  const u16 = (n: number) => new anchor.BN(n).toArrayLike(Buffer, "le", 2);
  const u64 = (n: number | anchor.BN) => new anchor.BN(n).toArrayLike(Buffer, "le", 8);
  const u32 = (n: number) => new anchor.BN(n).toArrayLike(Buffer, "le", 4);

  const pda = {
    config: () => find(seed("config")),
    mint: () => find(seed("time_mint")),
    vault: () => find(seed("vault")),
    treasury: () => find(seed("treasury")),
    faucetPool: () => find(seed("faucet_pool")),
    category: (id: number) => find(seed("category"), u16(id)),
    profile: (w: PublicKey) => find(seed("profile"), w.toBuffer()),
    post: (id: number | anchor.BN) => find(seed("post"), u64(id)),
    comment: (post: PublicKey, idx: number) => find(seed("comment"), post.toBuffer(), u32(idx)),
  };

  const wallet = provider.wallet.publicKey;
  const ata = getAssociatedTokenAddressSync(pda.mint(), wallet);
  console.log("wallet", wallet.toBase58());

  // profile
  const profile = pda.profile(wallet);
  if (!(await program.account.userProfile.fetchNullable(profile))) {
    await program.methods.createProfile(null).accountsPartial({ user: wallet, profile, systemProgram: SystemProgram.programId }).rpc();
    console.log("profile created");
  }

  // faucet TIME
  try {
    await program.methods.faucet().accountsPartial({
      user: wallet,
      config: pda.config(),
      profile,
      timeMint: pda.mint(),
      faucetPool: pda.faucetPool(),
      userAta: ata,
    }).rpc();
    console.log("faucet claimed");
  } catch (e: any) {
    console.log("faucet skip:", e.message?.slice(0, 80));
  }
  try {
    const acc = await getAccount(provider.connection, ata);
    console.log("TIME balance ui:", Number(acc.amount) / 1e6);
  } catch {
    console.log("no TIME ata yet");
  }

  async function victimFor(categoryId: number) {
    const cat: any = await program.account.category.fetch(pda.category(categoryId));
    const slot: PublicKey = cat.slots[cat.next];
    return slot.equals(PublicKey.default) ? null : slot;
  }

  async function createPost(categoryId: number, title: string, body: string, media = "") {
    const cfg: any = await program.account.config.fetch(pda.config());
    const victim = await victimFor(categoryId);
    const post = pda.post(cfg.postCount);
    const sig = await program.methods
      .createPost(title, body, media, [])
      .accountsPartial({
        author: wallet,
        config: pda.config(),
        category: pda.category(categoryId),
        profile,
        post,
        victim,
      })
      .rpc();
    const id = Number(cfg.postCount);
    console.log("post", id, title, sig);
    return id;
  }

  async function comment(postId: number, body: string) {
    const postAcc: any = await program.account.post.fetch(pda.post(postId));
    const commentKey = pda.comment(pda.post(postId), postAcc.commentCount);
    const sig = await program.methods
      .createComment(body, "")
      .accountsPartial({ commenter: wallet, profile, post: pda.post(postId), comment: commentKey })
      .rpc();
    console.log("comment on", postId, sig);
  }

  async function vote(postId: number, up: boolean, votes = 1) {
    const postAcc: any = await program.account.post.fetch(pda.post(postId));
    const postKey = pda.post(postId);
    const authorProfile = pda.profile(postAcc.author);
    if (up) {
      const sig = await program.methods.upvotePost(votes).accountsPartial({
        voter: wallet,
        config: pda.config(),
        post: postKey,
        authorProfile,
        voterAta: ata,
        vault: pda.vault(),
        tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc();
      console.log("upvote", postId, "x"+votes, sig);
    } else {
      const sig = await program.methods.downvotePost(votes).accountsPartial({
        voter: wallet,
        config: pda.config(),
        post: postKey,
        timeMint: pda.mint(),
        voterAta: ata,
        treasury: pda.treasury(),
        tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc();
      console.log("downvote", postId, "x"+votes, sig);
    }
  }

  const p1 = await createPost(2, "Posts battle for time ⚔️", "Every post starts with 5 free minutes. Upvote = +60s for 1 $TIME. Downvote = −60s (50% burn / 50% DAO). This is Battlechan on Solana.");
  const p2 = await createPost(5, "Why SocialFi keeps dying", "friend.tech and Farcaster had hype but no cost to engagement. We make attention scarce and creators earn. Demo post for the Colosseum walkthrough.");
  const p3 = await createPost(3, "Build log: Anchor + Token-2022", "Thread vaults are PDAs. Category ring buffer holds 125 live posts. When the clock hits zero the post is archived forever.");

  await vote(p1, true, 2);
  await vote(p2, true, 1);
  await vote(p3, false, 1);
  await comment(p1, "First! This is the live onchain comment for the demo video.");
  await comment(p1, "Clock is already ticking — better upvote before it archives.");
  await comment(p2, "No cost to posting = noise. TIME tax fixes the feed.");

  console.log("done posts", p1, p2, p3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
