use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{
    self, mint_to, set_authority, spl_token::instruction::AuthorityType, Mint, MintTo,
    SetAuthority, Token, TokenAccount,
};

use crate::constants::*;
use crate::errors::BattleError;
use crate::state::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init, payer = admin, space = 8 + Config::INIT_SPACE,
        seeds = [b"config"], bump
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(
        init, payer = admin,
        mint::decimals = TIME_DECIMALS, mint::authority = config,
        seeds = [b"time_mint"], bump
    )]
    pub time_mint: Box<Account<'info, Mint>>,

    /// Holds all $TIME paid into post pots.
    #[account(
        init, payer = admin,
        token::mint = time_mint, token::authority = config,
        seeds = [b"vault"], bump
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// DAO treasury: receives 50% of downvote $TIME, funds staking rewards.
    #[account(
        init, payer = admin,
        token::mint = time_mint, token::authority = config,
        seeds = [b"treasury"], bump
    )]
    pub treasury: Box<Account<'info, TokenAccount>>,

    /// Airdrop / incentive pool that backs the testnet faucet.
    #[account(
        init, payer = admin,
        token::mint = time_mint, token::authority = config,
        seeds = [b"faucet_pool"], bump
    )]
    pub faucet_pool: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed, payer = admin,
        associated_token::mint = time_mint, associated_token::authority = admin
    )]
    pub admin_ata: Box<Account<'info, TokenAccount>>,

    /// $KARMA: a real SPL token. Only this program (via the config PDA) can mint it, up to the 1T cap.
    #[account(
        init, payer = admin,
        mint::decimals = KARMA_DECIMALS, mint::authority = config,
        seeds = [b"karma_mint"], bump
    )]
    pub karma_mint: Box<Account<'info, Mint>>,

    /// Escrow for staked $KARMA (auto-stake on earn).
    #[account(
        init, payer = admin,
        token::mint = karma_mint, token::authority = config,
        seeds = [b"karma_vault"], bump
    )]
    pub karma_vault: Box<Account<'info, TokenAccount>>,

    /// DAO's $KARMA treasury: spent karma (bombs / resurrections) returns here.
    #[account(
        init, payer = admin,
        token::mint = karma_mint, token::authority = config,
        seeds = [b"karma_treasury"], bump
    )]
    pub karma_treasury_ta: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let bump = ctx.bumps.config;
    {
        let c = &mut ctx.accounts.config;
        c.admin = ctx.accounts.admin.key();
        c.time_mint = ctx.accounts.time_mint.key();
        c.vault = ctx.accounts.vault.key();
        c.treasury = ctx.accounts.treasury.key();
        c.faucet_pool = ctx.accounts.faucet_pool.key();
        c.karma_mint = ctx.accounts.karma_mint.key();
        c.karma_vault = ctx.accounts.karma_vault.key();
        c.karma_treasury_ta = ctx.accounts.karma_treasury_ta.key();
        c.bump = bump;
        c.category_count = 0;
        c.post_count = 0;
        c.proposal_count = 0;
        c.karma_minted = 0;
        c.karma_treasury = 0;
        c.total_burned = 0;
        c.total_to_dao = 0;

        c.initial_secs = 5 * 60; // each new post starts with 5 free minutes
        c.vote_secs = 60; // 1 $TIME = 1 minute
        c.vote_cost = TIME_UNIT; // 1 $TIME per vote
        c.op_share_bps = 7_500; // 75% OP / 25% top commenters
        c.comment_threshold = 5; // 5 likes => karma + payout eligibility
        c.bomb_karma = 50 * KARMA_UNIT;
        c.bomb_secs = 10 * 60;
        c.bomb_time_burn = 5 * TIME_UNIT;
        c.resurrect_karma = 50 * KARMA_UNIT;
        c.resurrect_secs = 10 * 60;
        c.withdraw_penalty_secs = 60;
        c.faucet_amount = 100 * TIME_UNIT;
        c.faucet_cooldown = SECONDS_PER_DAY;
        c.proposal_min_balance = 1_000 * TIME_UNIT;
        c.voting_period = 3 * SECONDS_PER_DAY;
        c.quorum = 10_000 * TIME_UNIT;
    }

    // Mint the fixed supply once: 40% DAO treasury, 20% airdrops/incentives, 40% team/advisors/marketing.
    let signer: &[&[&[u8]]] = &[&[b"config", &[bump]]];
    let dao = TIME_TOTAL_SUPPLY / 100 * 40;
    let incentives = TIME_TOTAL_SUPPLY / 100 * 20;
    let rest = TIME_TOTAL_SUPPLY - dao - incentives;

    for (to, amt) in [
        (ctx.accounts.treasury.to_account_info(), dao),
        (ctx.accounts.faucet_pool.to_account_info(), incentives),
        (ctx.accounts.admin_ata.to_account_info(), rest),
    ] {
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.time_mint.to_account_info(),
                    to,
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            amt,
        )?;
    }

    // Revoke mint authority: supply is fixed and can only deflate through downvote burns.
    set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.config.to_account_info(),
                account_or_mint: ctx.accounts.time_mint.to_account_info(),
            },
            signer,
        ),
        AuthorityType::MintTokens,
        None,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct CreateCategory<'info> {
    #[account(mut, address = config.admin @ BattleError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        init, payer = admin, space = 8 + Category::INIT_SPACE,
        seeds = [b"category", config.category_count.to_le_bytes().as_ref()], bump
    )]
    pub category: Box<Account<'info, Category>>,
    pub system_program: Program<'info, System>,
}

pub fn create_category(ctx: Context<CreateCategory>, name: String) -> Result<()> {
    require!(!name.is_empty(), BattleError::TextEmpty);
    require!(name.len() <= MAX_CATEGORY_NAME, BattleError::TextTooLong);
    let c = &mut ctx.accounts.category;
    c.id = ctx.accounts.config.category_count;
    c.name = name;
    c.slots = vec![Pubkey::default(); CATEGORY_CAP];
    c.next = 0;
    c.post_count = 0;
    c.bump = ctx.bumps.category;
    ctx.accounts.config.category_count += 1;
    Ok(())
}

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init, payer = user, space = 8 + UserProfile::INIT_SPACE,
        seeds = [b"profile", user.key().as_ref()], bump
    )]
    pub profile: Box<Account<'info, UserProfile>>,
    pub system_program: Program<'info, System>,
}

pub fn create_profile(ctx: Context<CreateProfile>, referrer: Option<Pubkey>) -> Result<()> {
    if let Some(r) = referrer {
        require!(r != ctx.accounts.user.key(), BattleError::InvalidReferrer);
    }
    let now = Clock::get()?.unix_timestamp;
    let p = &mut ctx.accounts.profile;
    p.authority = ctx.accounts.user.key();
    p.referrer = referrer;
    p.joined_at = now;
    p.karma = 0;
    p.karma_lifetime = 0;
    p.posts = 0;
    p.comments = 0;
    p.last_comment_ts = 0;
    p.last_stake_claim_ts = now;
    p.last_faucet_ts = 0;
    p.decoration = 0;
    p.max_post_up_votes = 0;
    p.max_comment_likes = 0;
    p.max_comment_dislikes = 0;
    p.bump = ctx.bumps.profile;
    Ok(())
}

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"profile", user.key().as_ref()], bump = profile.bump
    )]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(address = config.time_mint)]
    pub time_mint: Box<Account<'info, Mint>>,
    #[account(mut, address = config.faucet_pool)]
    pub faucet_pool: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = user,
        associated_token::mint = time_mint, associated_token::authority = user
    )]
    pub user_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Testnet / launch airdrop: claim $TIME from the incentives pool once per cooldown.
pub fn faucet(ctx: Context<Faucet>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let cfg = &ctx.accounts.config;
    let p = &mut ctx.accounts.profile;
    require!(
        p.last_faucet_ts == 0 || now >= p.last_faucet_ts + cfg.faucet_cooldown,
        BattleError::FaucetCooldown
    );
    p.last_faucet_ts = now;
    let bump = cfg.bump;
    let amount = cfg.faucet_amount;
    let signer: &[&[&[u8]]] = &[&[b"config", &[bump]]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.faucet_pool.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;
    Ok(())
}
