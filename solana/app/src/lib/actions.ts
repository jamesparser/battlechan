import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { pda, TIME_UNIT } from "./chain";

const NONE = null; // Anchor optional account => pass null

export class Actions {
  constructor(public program: any, public wallet: PublicKey) {}

  ata(owner: PublicKey = this.wallet) {
    return getAssociatedTokenAddressSync(pda.mint(), owner);
  }

  karmaAta(owner: PublicKey = this.wallet) {
    return getAssociatedTokenAddressSync(pda.karmaMint(), owner);
  }

  private async victimFor(categoryId: number): Promise<PublicKey | null> {
    const cat: any = await this.program.account.category.fetch(pda.category(categoryId));
    const slot: PublicKey = cat.slots[cat.next];
    return slot.equals(PublicKey.default) ? null : slot;
  }

  async createProfile(referrer?: string) {
    let ref: PublicKey | null = null;
    if (referrer) ref = new PublicKey(referrer);
    return this.program.methods
      .createProfile(ref)
      .accountsPartial({ user: this.wallet, profile: pda.profile(this.wallet), systemProgram: SystemProgram.programId })
      .rpc();
  }

  async faucet() {
    return this.program.methods
      .faucet()
      .accountsPartial({
        user: this.wallet,
        config: pda.config(),
        profile: pda.profile(this.wallet),
        timeMint: pda.mint(),
        faucetPool: pda.faucetPool(),
        userAta: this.ata(),
      })
      .rpc();
  }

  async createCategory(name: string) {
    const cfg: any = await this.program.account.config.fetch(pda.config());
    return this.program.methods
      .createCategory(name)
      .accountsPartial({
        admin: this.wallet,
        config: pda.config(),
        category: pda.category(cfg.categoryCount),
      })
      .rpc();
  }

  async createPost(categoryId: number, title: string, body: string, media: string, poll: string[]) {
    const cfg: any = await this.program.account.config.fetch(pda.config());
    const victim = await this.victimFor(categoryId);
    return this.program.methods
      .createPost(title, body, media, poll)
      .accountsPartial({
        author: this.wallet,
        config: pda.config(),
        category: pda.category(categoryId),
        profile: pda.profile(this.wallet),
        post: pda.post(cfg.postCount),
        victim,
      })
      .rpc();
  }

  async createComment(post: any, body: string, media: string) {
    return this.program.methods
      .createComment(body, media)
      .accountsPartial({
        commenter: this.wallet,
        profile: pda.profile(this.wallet),
        post: pda.post(post.id),
        comment: pda.comment(pda.post(post.id), post.commentCount),
      })
      .rpc();
  }

  async vote(post: any, votes: number, up: boolean) {
    const postKey = pda.post(post.id);
    if (up) {
      return this.program.methods
        .upvotePost(votes)
        .accountsPartial({
          voter: this.wallet,
          config: pda.config(),
          post: postKey,
          authorProfile: pda.profile(post.author),
          voterAta: this.ata(),
          vault: pda.vault(),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    }
    return this.program.methods
      .downvotePost(votes)
      .accountsPartial({
        voter: this.wallet,
        config: pda.config(),
        post: postKey,
        timeMint: pda.mint(),
        voterAta: this.ata(),
        treasury: pda.treasury(),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async voteComment(post: any, comment: any, up: boolean) {
    const postKey = pda.post(post.id);
    const commentKey = pda.comment(postKey, comment.index);
    const authorProfileKey = pda.profile(comment.author);
    const authorProfile: any = await this.program.account.userProfile.fetch(authorProfileKey);
    return this.program.methods
      .voteComment(up)
      .accountsPartial({
        voter: this.wallet,
        voterProfile: pda.profile(this.wallet),
        config: pda.config(),
        post: postKey,
        comment: commentKey,
        authorProfile: authorProfileKey,
        referrerProfile: authorProfile.referrer ? pda.profile(authorProfile.referrer) : NONE,
        commentVote: pda.cvote(commentKey, this.wallet),
        karmaMint: pda.karmaMint(),
        karmaVault: pda.karmaVault(),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async pollVote(post: any, option: number) {
    const postKey = pda.post(post.id);
    return this.program.methods
      .pollVote(option)
      .accountsPartial({
        voter: this.wallet,
        voterProfile: pda.profile(this.wallet),
        post: postKey,
        pollVote: pda.pvote(postKey, this.wallet),
      })
      .rpc();
  }

  async opWithdraw(post: any, amountBase: BN) {
    return this.program.methods
      .opWithdraw(amountBase)
      .accountsPartial({
        owner: this.wallet,
        config: pda.config(),
        post: pda.post(post.id),
        timeMint: pda.mint(),
        vault: pda.vault(),
        ownerAta: this.ata(),
      })
      .rpc();
  }

  async claimCommentReward(post: any, comment: any) {
    const postKey = pda.post(post.id);
    return this.program.methods
      .claimCommentReward()
      .accountsPartial({
        commenter: this.wallet,
        config: pda.config(),
        post: postKey,
        comment: pda.comment(postKey, comment.index),
        timeMint: pda.mint(),
        vault: pda.vault(),
        commenterAta: this.ata(),
      })
      .rpc();
  }

  async claimStaking() {
    return this.program.methods
      .claimStakingRewards()
      .accountsPartial({
        user: this.wallet,
        config: pda.config(),
        profile: pda.profile(this.wallet),
        timeMint: pda.mint(),
        treasury: pda.treasury(),
        userAta: this.ata(),
      })
      .rpc();
  }

  async bomb(post: any) {
    return this.program.methods
      .karmaBomb()
      .accountsPartial({
        bomber: this.wallet,
        config: pda.config(),
        profile: pda.profile(this.wallet),
        post: pda.post(post.id),
        timeMint: pda.mint(),
        treasury: pda.treasury(),
        karmaVault: pda.karmaVault(),
        karmaTreasuryTa: pda.karmaTreasury(),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async resurrect(post: any) {
    const victim = await this.victimFor(post.category);
    return this.program.methods
      .karmaResurrect()
      .accountsPartial({
        resurrector: this.wallet,
        config: pda.config(),
        profile: pda.profile(this.wallet),
        post: pda.post(post.id),
        category: pda.category(post.category),
        victim,
        karmaVault: pda.karmaVault(),
        karmaTreasuryTa: pda.karmaTreasury(),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async stakeKarma(amountBase: BN) {
    return this.program.methods
      .stakeKarma(amountBase)
      .accountsPartial({
        user: this.wallet,
        config: pda.config(),
        profile: pda.profile(this.wallet),
        userKarmaAta: this.karmaAta(),
        karmaVault: pda.karmaVault(),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async unstakeKarma(amountBase: BN) {
    return this.program.methods
      .unstakeKarma(amountBase)
      .accountsPartial({
        user: this.wallet,
        config: pda.config(),
        profile: pda.profile(this.wallet),
        karmaMint: pda.karmaMint(),
        userKarmaAta: this.karmaAta(),
        karmaVault: pda.karmaVault(),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async buyFlair(post: any, flair: number) {
    return this.program.methods
      .buyPostFlair(flair)
      .accountsPartial({
        owner: this.wallet,
        config: pda.config(),
        post: pda.post(post.id),
        ownerAta: this.ata(),
        treasury: pda.treasury(),
      })
      .rpc();
  }

  async buyDecoration(id: number) {
    return this.program.methods
      .buyProfileDecoration(id)
      .accountsPartial({
        user: this.wallet,
        config: pda.config(),
        profile: pda.profile(this.wallet),
        userAta: this.ata(),
        treasury: pda.treasury(),
      })
      .rpc();
  }

  async createProposal(
    title: string, description: string, kind: number, param: number, value: BN, recipient: PublicKey
  ) {
    const cfg: any = await this.program.account.config.fetch(pda.config());
    return this.program.methods
      .createProposal(title, description, kind, param, value, recipient)
      .accountsPartial({
        proposer: this.wallet,
        config: pda.config(),
        proposerAta: this.ata(),
        proposal: pda.proposal(cfg.proposalCount),
      })
      .rpc();
  }

  async daoVote(proposal: any, support: boolean) {
    const key = pda.proposal(proposal.id);
    return this.program.methods
      .daoVote(support)
      .accountsPartial({
        voter: this.wallet,
        config: pda.config(),
        voterAta: this.ata(),
        proposal: key,
        daoVote: pda.dvote(key, this.wallet),
      })
      .rpc();
  }

  async executeProposal(proposal: any) {
    const recipientAta =
      proposal.kind === 1 ? this.ata(proposal.recipient) : NONE;
    return this.program.methods
      .executeProposal()
      .accountsPartial({
        executor: this.wallet,
        config: pda.config(),
        proposal: pda.proposal(proposal.id),
        treasury: pda.treasury(),
        recipientAta,
      })
      .rpc();
  }
}

export const toBase = (time: number) => new BN(Math.round(time * TIME_UNIT));
export const karmaToBase = (k: number) => new BN(Math.round(k * 1_000_000));
