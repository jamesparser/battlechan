use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::BattleError;
use crate::state::*;

#[derive(Accounts)]
pub struct OpWithdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump,
        has_one = owner @ BattleError::Unauthorized
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(address = config.time_mint)]
    pub time_mint: Box<Account<'info, Mint>>,
    #[account(mut, address = config.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = owner,
        associated_token::mint = time_mint, associated_token::authority = owner
    )]
    pub owner_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// The post owner withdraws up to 75% of the $TIME pot. After the initial visibility window only.
/// Withdrawing costs visibility: each vote-worth withdrawn shaves `withdraw_penalty_secs` off the timer.
pub fn op_withdraw(ctx: Context<OpWithdraw>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let cfg = &ctx.accounts.config;
    let post = &mut ctx.accounts.post;
    require!(
        now >= post.created_at + cfg.initial_secs,
        BattleError::TooEarly
    );
    let available = post.op_pot(cfg.op_share_bps).saturating_sub(post.op_withdrawn);
    require!(available > 0 && amount > 0, BattleError::NothingToWithdraw);
    let amount = amount.min(available);

    post.op_withdrawn += amount;
    let votes_worth = (amount / cfg.vote_cost.max(1)) as i64;
    post.expires_at = post
        .expires_at
        .saturating_sub(votes_worth.saturating_mul(cfg.withdraw_penalty_secs));

    let signer: &[&[&[u8]]] = &[&[b"config", &[cfg.bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner_ata.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimCommentReward<'info> {
    #[account(mut)]
    pub commenter: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(
        mut,
        seeds = [b"comment", post.key().as_ref(), comment.index.to_le_bytes().as_ref()],
        bump = comment.bump,
        constraint = comment.post == post.key(),
        constraint = comment.author == commenter.key() @ BattleError::Unauthorized
    )]
    pub comment: Box<Account<'info, Comment>>,
    #[account(address = config.time_mint)]
    pub time_mint: Box<Account<'info, Mint>>,
    #[account(mut, address = config.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = commenter,
        associated_token::mint = time_mint, associated_token::authority = commenter
    )]
    pub commenter_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Commenters with >= `comment_threshold` likes share the 25% commenter pot pro-rata to their likes.
pub fn claim_comment_reward(ctx: Context<ClaimCommentReward>) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let post = &mut ctx.accounts.post;
    let comment = &mut ctx.accounts.comment;
    require!(
        comment.likes >= cfg.comment_threshold && post.qualified_likes > 0,
        BattleError::NotEligible
    );

    let pot = post.commenter_pot(cfg.op_share_bps);
    let entitled = ((pot as u128) * (comment.likes as u128) / (post.qualified_likes as u128)) as u64;
    let owed = entitled.saturating_sub(comment.reward_claimed);
    let remaining = pot.saturating_sub(post.commenter_paid);
    let pay = owed.min(remaining);
    require!(pay > 0, BattleError::NothingToWithdraw);

    comment.reward_claimed += pay;
    post.commenter_paid += pay;

    let signer: &[&[&[u8]]] = &[&[b"config", &[cfg.bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.commenter_ata.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer,
        ),
        pay,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimStaking<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [b"profile", user.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(address = config.time_mint)]
    pub time_mint: Box<Account<'info, Mint>>,
    #[account(mut, address = config.treasury)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = time_mint, associated_token::authority = user
    )]
    pub user_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// $KARMA is auto-staked. Stakers who commented within the last 24h earn $TIME from the DAO treasury:
/// 3% base APY, +1-3% per posting/commenting milestone, capped at 10%.
pub fn claim_staking_rewards(ctx: Context<ClaimStaking>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let cfg = &ctx.accounts.config;
    let p = &mut ctx.accounts.profile;
    require!(
        p.last_comment_ts > 0 && now - p.last_comment_ts <= SECONDS_PER_DAY,
        BattleError::NeedDailyComment
    );
    let elapsed = (now - p.last_stake_claim_ts).clamp(0, MAX_STAKE_WINDOW_SECS) as u128;
    // $KARMA and $TIME both have 6 decimals, so base units map 1:1.
    let reward = (p.karma as u128)
        * (p.apy_bps() as u128)
        * elapsed
        / (10_000u128 * SECONDS_PER_YEAR);
    let reward = (reward as u64).min(ctx.accounts.treasury.amount);
    p.last_stake_claim_ts = now;
    require!(reward > 0, BattleError::NothingToWithdraw);

    let signer: &[&[&[u8]]] = &[&[b"config", &[cfg.bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer,
        ),
        reward,
    )?;
    Ok(())
}
