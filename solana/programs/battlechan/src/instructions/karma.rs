use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use super::posts::bump_into_ring;
use crate::errors::BattleError;
use crate::state::*;

#[derive(Accounts)]
pub struct KarmaBomb<'info> {
    pub bomber: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [b"profile", bomber.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump,
        constraint = !post.archived @ BattleError::PostArchived
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(mut, address = config.time_mint)]
    pub time_mint: Box<Account<'info, Mint>>,
    #[account(mut, address = config.treasury)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.karma_vault)]
    pub karma_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.karma_treasury_ta)]
    pub karma_treasury_ta: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Move spent $KARMA from the staking vault back to the DAO's $KARMA treasury.
fn spend_karma<'info>(
    config: &Account<'info, Config>,
    vault: &Account<'info, TokenAccount>,
    treasury: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let signer: &[&[&[u8]]] = &[&[b"config", &[config.bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            token::Transfer {
                from: vault.to_account_info(),
                to: treasury.to_account_info(),
                authority: config.to_account_info(),
            },
            signer,
        ),
        amount,
    )
}

/// Spend staked $KARMA (returned to the DAO treasury) to cut 10 minutes off a post without owning $TIME.
/// Like a downvote, the equivalent $TIME is burned (here: out of the DAO treasury) and the rest stays with the DAO.
pub fn karma_bomb(ctx: Context<KarmaBomb>) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let (cost, secs, burn_target, bump) =
        (cfg.bomb_karma, cfg.bomb_secs, cfg.bomb_time_burn, cfg.bump);
    let profile = &mut ctx.accounts.profile;
    require!(profile.karma >= cost, BattleError::NotEnoughKarma);
    profile.karma -= cost;

    let burn_amt = burn_target.min(ctx.accounts.treasury.amount);
    let post = &mut ctx.accounts.post;
    post.expires_at = post.expires_at.saturating_sub(secs);
    post.down_votes = post.down_votes.saturating_add(1);
    post.burned_from_down = post.burned_from_down.saturating_add(burn_amt);
    post.dao_from_down = post.dao_from_down.saturating_add(burn_amt);

    let cfg = &mut ctx.accounts.config;
    cfg.karma_treasury = cfg.karma_treasury.saturating_add(cost);
    cfg.total_burned = cfg.total_burned.saturating_add(burn_amt);

    spend_karma(
        &ctx.accounts.config,
        &ctx.accounts.karma_vault,
        &ctx.accounts.karma_treasury_ta,
        &ctx.accounts.token_program,
        cost,
    )?;

    if burn_amt > 0 {
        let signer: &[&[&[u8]]] = &[&[b"config", &[bump]]];
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.time_mint.to_account_info(),
                    from: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            burn_amt,
        )?;
    }
    Ok(())
}

#[derive(Accounts)]
pub struct KarmaResurrect<'info> {
    pub resurrector: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [b"profile", resurrector.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump,
        constraint = post.archived @ BattleError::PostNotArchived
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(
        mut, seeds = [b"category", post.category.to_le_bytes().as_ref()], bump = category.bump
    )]
    pub category: Box<Account<'info, Category>>,
    /// The live post currently in the ring slot that the resurrected post will take.
    #[account(mut)]
    pub victim: Option<Account<'info, Post>>,
    #[account(mut, address = config.karma_vault)]
    pub karma_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.karma_treasury_ta)]
    pub karma_treasury_ta: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Spend staked $KARMA to pull an archived post back into the category (+10 minutes).
/// The post re-enters the arena and bumps the oldest live post out, exactly like a new post.
pub fn karma_resurrect(ctx: Context<KarmaResurrect>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let cost = ctx.accounts.config.resurrect_karma;
    let secs = ctx.accounts.config.resurrect_secs;
    let profile = &mut ctx.accounts.profile;
    require!(profile.karma >= cost, BattleError::NotEnoughKarma);
    profile.karma -= cost;
    ctx.accounts.config.karma_treasury = ctx.accounts.config.karma_treasury.saturating_add(cost);

    spend_karma(
        &ctx.accounts.config,
        &ctx.accounts.karma_vault,
        &ctx.accounts.karma_treasury_ta,
        &ctx.accounts.token_program,
        cost,
    )?;

    let post_key = ctx.accounts.post.key();
    bump_into_ring(&mut ctx.accounts.category, &mut ctx.accounts.victim, post_key)?;

    let post = &mut ctx.accounts.post;
    post.archived = false;
    post.expires_at = post.expires_at.max(now).saturating_add(secs);
    Ok(())
}

#[derive(Accounts)]
pub struct StakeKarma<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [b"profile", user.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(mut, token::mint = config.karma_mint, token::authority = user)]
    pub user_karma_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.karma_vault)]
    pub karma_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Move $KARMA from your wallet back into staking (earns yield, counts toward bomb/resurrect).
pub fn stake_karma(ctx: Context<StakeKarma>, amount: u64) -> Result<()> {
    require!(amount > 0, BattleError::ZeroVotes);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.user_karma_ata.to_account_info(),
                to: ctx.accounts.karma_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;
    let p = &mut ctx.accounts.profile;
    p.karma = p.karma.checked_add(amount).ok_or(BattleError::MathOverflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct UnstakeKarma<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [b"profile", user.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(address = config.karma_mint)]
    pub karma_mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = karma_mint, associated_token::authority = user
    )]
    pub user_karma_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.karma_vault)]
    pub karma_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Withdraw staked $KARMA to your wallet as a liquid SPL token (tradeable / LP-able).
/// Unstaked karma earns no staking yield and cannot be spent on bombs or resurrections.
pub fn unstake_karma(ctx: Context<UnstakeKarma>, amount: u64) -> Result<()> {
    require!(amount > 0, BattleError::ZeroVotes);
    let p = &mut ctx.accounts.profile;
    require!(p.karma >= amount, BattleError::NotEnoughKarma);
    p.karma -= amount;
    let signer: &[&[&[u8]]] = &[&[b"config", &[ctx.accounts.config.bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.karma_vault.to_account_info(),
                to: ctx.accounts.user_karma_ata.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;
    Ok(())
}
