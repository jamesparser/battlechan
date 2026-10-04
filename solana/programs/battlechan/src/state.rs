use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub time_mint: Pubkey,
    pub vault: Pubkey,
    pub treasury: Pubkey,
    pub faucet_pool: Pubkey,
    pub karma_mint: Pubkey,
    /// Escrow holding every staked $KARMA token.
    pub karma_vault: Pubkey,
    /// DAO $KARMA treasury: spent karma lands here.
    pub karma_treasury_ta: Pubkey,
    pub bump: u8,
    pub category_count: u16,
    pub post_count: u64,
    pub proposal_count: u64,
    /// Total $KARMA ever minted (base units).
    pub karma_minted: u64,
    /// Total spent $KARMA returned to the DAO (base units, accounting).
    pub karma_treasury: u64,
    pub total_burned: u64,
    pub total_to_dao: u64,

    // ---- DAO-governed parameters ----
    pub initial_secs: i64,
    pub vote_secs: i64,
    /// $TIME (base units) per single up/down vote.
    pub vote_cost: u64,
    pub op_share_bps: u16,
    pub comment_threshold: u32,
    pub bomb_karma: u64,
    pub bomb_secs: i64,
    /// $TIME (base units) burned out of the DAO treasury per karma bomb.
    pub bomb_time_burn: u64,
    pub resurrect_karma: u64,
    pub resurrect_secs: i64,
    /// Seconds knocked off a post per vote-worth of $TIME the owner withdraws.
    pub withdraw_penalty_secs: i64,
    pub faucet_amount: u64,
    pub faucet_cooldown: i64,
    pub proposal_min_balance: u64,
    pub voting_period: i64,
    pub quorum: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Category {
    pub id: u16,
    #[max_len(24)]
    pub name: String,
    /// Ring buffer of the 20 live posts. Pubkey::default() = empty slot.
    pub slots: [Pubkey; CATEGORY_CAP],
    pub next: u8,
    pub post_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub authority: Pubkey,
    pub referrer: Option<Pubkey>,
    pub joined_at: i64,
    /// Staked $KARMA in base units (auto-staked; the tokens sit in the karma vault).
    pub karma: u64,
    pub karma_lifetime: u64,
    pub posts: u32,
    pub comments: u32,
    pub last_comment_ts: i64,
    pub last_stake_claim_ts: i64,
    pub last_faucet_ts: i64,
    pub decoration: u8,
    // Popularity counters used for badges.
    pub max_post_up_votes: u64,
    pub max_comment_likes: u32,
    pub max_comment_dislikes: u32,
    pub bump: u8,
}

impl UserProfile {
    /// Extra APY (in whole percent) earned from posting / commenting milestone badges.
    pub fn badge_bonus_pct(&self) -> u64 {
        fn tier(n: u32) -> u64 {
            let mut t = 0;
            if n >= 10 {
                t += 1;
            }
            if n >= 50 {
                t += 1;
            }
            if n >= 100 {
                t += 2;
            }
            if n >= 1000 {
                t += 3;
            }
            t
        }
        tier(self.comments) + tier(self.posts)
    }

    pub fn apy_bps(&self) -> u64 {
        let bps = BASE_APY_BPS + self.badge_bonus_pct() * 100;
        bps.min(MAX_APY_BPS)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Post {
    pub id: u64,
    pub category: u16,
    pub author: Pubkey,
    /// Current owner (NFT-lite: can be traded; owner receives the 75% pot).
    pub owner: Pubkey,
    pub created_at: i64,
    pub expires_at: i64,
    #[max_len(80)]
    pub title: String,
    #[max_len(1000)]
    pub body: String,
    #[max_len(200)]
    pub media_uri: String,
    pub flair: u8,
    pub up_votes: u64,
    pub down_votes: u64,
    pub comment_count: u32,
    /// Total $TIME (base units) paid into this post by upvotes.
    pub pot: u64,
    pub op_withdrawn: u64,
    pub commenter_paid: u64,
    pub qualified_likes: u64,
    pub burned_from_down: u64,
    pub dao_from_down: u64,
    /// Number of wallets that reported this post to the admin for review.
    pub reports: u32,
    pub archived: bool,
    #[max_len(4, 40)]
    pub poll_options: Vec<String>,
    pub poll_votes: [u32; 4],
    pub bump: u8,
}

impl Post {
    pub fn op_pot(&self, op_share_bps: u16) -> u64 {
        ((self.pot as u128) * (op_share_bps as u128) / 10_000u128) as u64
    }
    pub fn commenter_pot(&self, op_share_bps: u16) -> u64 {
        self.pot.saturating_sub(self.op_pot(op_share_bps))
    }
}

#[account]
#[derive(InitSpace)]
pub struct Comment {
    pub post: Pubkey,
    pub author: Pubkey,
    pub index: u32,
    #[max_len(500)]
    pub body: String,
    #[max_len(200)]
    pub media_uri: String,
    pub created_at: i64,
    pub likes: u32,
    pub dislikes: u32,
    pub reward_claimed: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CommentVote {
    pub up: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Report {
    pub at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct PollVote {
    pub option: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Pubkey,
    #[max_len(64)]
    pub title: String,
    #[max_len(256)]
    pub description: String,
    /// 0 = parameter change, 1 = treasury spend
    pub kind: u8,
    pub param: u8,
    pub value: u64,
    pub recipient: Pubkey,
    pub yes: u64,
    pub no: u64,
    pub end_ts: i64,
    pub executed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DaoVote {
    pub support: bool,
    pub weight: u64,
}
