//! BattleChan on Solana.
//!
//! Time-boxed, token-curated boards: every post starts with 30 minutes on the clock, upvotes add
//! 5 minutes, downvotes remove 5. Only 20 posts live per category; newer posts bump the oldest
//! into the permanent archive. $TIME flows: upvotes -> post pot (75% OP / 25% top commenters),
//! downvotes -> 50% burned / 50% DAO treasury. $KARMA (earned from comment likes) is auto-staked
//! and can be spent to bomb or resurrect posts.
use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("J4FZnCJRHErXyzK677xbiEURnQ5rf5Js7w47eJaMu2CD");

#[program]
pub mod battlechan {
    use super::*;

    // ---- setup ----
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        admin::initialize(ctx)
    }
    pub fn create_category(ctx: Context<CreateCategory>, name: String) -> Result<()> {
        admin::create_category(ctx, name)
    }
    pub fn create_profile(ctx: Context<CreateProfile>, referrer: Option<Pubkey>) -> Result<()> {
        admin::create_profile(ctx, referrer)
    }
    pub fn faucet(ctx: Context<Faucet>) -> Result<()> {
        admin::faucet(ctx)
    }

    // ---- posts & comments ----
    pub fn create_post(
        ctx: Context<CreatePost>,
        title: String,
        body: String,
        media_uri: String,
        poll_options: Vec<String>,
    ) -> Result<()> {
        posts::create_post(ctx, title, body, media_uri, poll_options)
    }
    pub fn create_comment(
        ctx: Context<CreateComment>,
        body: String,
        media_uri: String,
    ) -> Result<()> {
        posts::create_comment(ctx, body, media_uri)
    }
    pub fn poll_vote(ctx: Context<PollVoteCtx>, option: u8) -> Result<()> {
        posts::poll_vote(ctx, option)
    }
    pub fn buy_post_flair(ctx: Context<BuyPostFlair>, flair: u8) -> Result<()> {
        posts::buy_post_flair(ctx, flair)
    }
    pub fn buy_profile_decoration(
        ctx: Context<BuyProfileDecoration>,
        decoration: u8,
    ) -> Result<()> {
        posts::buy_profile_decoration(ctx, decoration)
    }
    pub fn report_post(ctx: Context<ReportPost>) -> Result<()> {
        posts::report_post(ctx)
    }
    pub fn trade_post(ctx: Context<TradePost>, price: u64) -> Result<()> {
        posts::trade_post(ctx, price)
    }

    // ---- voting ----
    pub fn upvote_post(ctx: Context<UpvotePost>, votes: u32) -> Result<()> {
        voting::upvote_post(ctx, votes)
    }
    pub fn downvote_post(ctx: Context<DownvotePost>, votes: u32) -> Result<()> {
        voting::downvote_post(ctx, votes)
    }
    pub fn vote_comment(ctx: Context<VoteComment>, up: bool) -> Result<()> {
        voting::vote_comment(ctx, up)
    }

    // ---- rewards ----
    pub fn op_withdraw(ctx: Context<OpWithdraw>, amount: u64) -> Result<()> {
        rewards::op_withdraw(ctx, amount)
    }
    pub fn claim_comment_reward(ctx: Context<ClaimCommentReward>) -> Result<()> {
        rewards::claim_comment_reward(ctx)
    }
    pub fn claim_staking_rewards(ctx: Context<ClaimStaking>) -> Result<()> {
        rewards::claim_staking_rewards(ctx)
    }

    // ---- karma ----
    pub fn karma_bomb(ctx: Context<KarmaBomb>) -> Result<()> {
        karma::karma_bomb(ctx)
    }
    pub fn karma_resurrect(ctx: Context<KarmaResurrect>) -> Result<()> {
        karma::karma_resurrect(ctx)
    }
    pub fn stake_karma(ctx: Context<StakeKarma>, amount: u64) -> Result<()> {
        karma::stake_karma(ctx, amount)
    }
    pub fn unstake_karma(ctx: Context<UnstakeKarma>, amount: u64) -> Result<()> {
        karma::unstake_karma(ctx, amount)
    }

    // ---- DAO ----
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
        kind: u8,
        param: u8,
        value: u64,
        recipient: Pubkey,
    ) -> Result<()> {
        dao::create_proposal(ctx, title, description, kind, param, value, recipient)
    }
    pub fn dao_vote(ctx: Context<DaoVoteCtx>, support: bool) -> Result<()> {
        dao::dao_vote(ctx, support)
    }
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        dao::execute_proposal(ctx)
    }
}
