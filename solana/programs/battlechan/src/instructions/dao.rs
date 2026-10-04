use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

use crate::constants::*;
use crate::errors::BattleError;
use crate::state::*;

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(token::mint = config.time_mint, token::authority = proposer)]
    pub proposer_ata: Box<Account<'info, TokenAccount>>,
    #[account(
        init, payer = proposer, space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", config.proposal_count.to_le_bytes().as_ref()], bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    pub system_program: Program<'info, System>,
}

/// kind 0: change a governed parameter (`param`, `value`). kind 1: spend `value` $TIME of treasury to `recipient`.
pub fn create_proposal(
    ctx: Context<CreateProposal>,
    title: String,
    description: String,
    kind: u8,
    param: u8,
    value: u64,
    recipient: Pubkey,
) -> Result<()> {
    require!(!title.is_empty(), BattleError::TextEmpty);
    require!(title.len() <= MAX_PROPOSAL_TITLE, BattleError::TextTooLong);
    require!(description.len() <= MAX_PROPOSAL_DESC, BattleError::TextTooLong);
    require!(kind <= 1, BattleError::InvalidParam);
    let cfg = &mut ctx.accounts.config;
    require!(
        ctx.accounts.proposer_ata.amount >= cfg.proposal_min_balance,
        BattleError::InsufficientTime
    );
    if kind == 0 {
        validate_param(param, value)?;
    }
    let now = Clock::get()?.unix_timestamp;
    let p = &mut ctx.accounts.proposal;
    p.id = cfg.proposal_count;
    p.proposer = ctx.accounts.proposer.key();
    p.title = title;
    p.description = description;
    p.kind = kind;
    p.param = param;
    p.value = value;
    p.recipient = recipient;
    p.yes = 0;
    p.no = 0;
    p.end_ts = now + cfg.voting_period;
    p.executed = false;
    p.bump = ctx.bumps.proposal;
    cfg.proposal_count += 1;
    Ok(())
}

fn validate_param(param: u8, value: u64) -> Result<()> {
    match param {
        PARAM_VOTE_COST | PARAM_COMMENT_THRESHOLD => require!(value > 0, BattleError::InvalidParam),
        PARAM_VOTE_SECS | PARAM_INITIAL_SECS => {
            require!(value > 0 && value < 30 * 86_400, BattleError::InvalidParam)
        }
        PARAM_OP_SHARE_BPS => require!(value <= 10_000, BattleError::InvalidParam),
        PARAM_BOMB_KARMA | PARAM_RESURRECT_KARMA | PARAM_FAUCET_AMOUNT | PARAM_QUORUM
        | PARAM_WITHDRAW_PENALTY => {}
        PARAM_VOTING_PERIOD => require!(value >= 60, BattleError::InvalidParam),
        _ => return err!(BattleError::InvalidParam),
    }
    Ok(())
}

#[derive(Accounts)]
pub struct DaoVoteCtx<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    pub config: Box<Account<'info, Config>>,
    #[account(token::mint = config.time_mint, token::authority = voter)]
    pub voter_ata: Box<Account<'info, TokenAccount>>,
    #[account(
        mut, seeds = [b"proposal", proposal.id.to_le_bytes().as_ref()], bump = proposal.bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(
        init, payer = voter, space = 8 + DaoVote::INIT_SPACE,
        seeds = [b"dvote", proposal.key().as_ref(), voter.key().as_ref()], bump
    )]
    pub dao_vote: Box<Account<'info, DaoVote>>,
    pub system_program: Program<'info, System>,
}

/// Token-weighted vote. Weight = the voter's $TIME balance at vote time.
pub fn dao_vote(ctx: Context<DaoVoteCtx>, support: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let p = &mut ctx.accounts.proposal;
    require!(now < p.end_ts, BattleError::VotingClosed);
    let weight = ctx.accounts.voter_ata.amount;
    require!(weight > 0, BattleError::InsufficientTime);
    if support {
        p.yes = p.yes.saturating_add(weight);
    } else {
        p.no = p.no.saturating_add(weight);
    }
    ctx.accounts.dao_vote.support = support;
    ctx.accounts.dao_vote.weight = weight;
    Ok(())
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    pub executor: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"proposal", proposal.id.to_le_bytes().as_ref()], bump = proposal.bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut, address = config.treasury)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    /// Required for kind 1 (treasury spend): the recipient's $TIME token account.
    #[account(mut)]
    pub recipient_ata: Option<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let cfg = &mut ctx.accounts.config;
    let p = &mut ctx.accounts.proposal;
    require!(now >= p.end_ts, BattleError::VotingOpen);
    require!(!p.executed, BattleError::AlreadyExecuted);
    require!(
        p.yes > p.no && p.yes.saturating_add(p.no) >= cfg.quorum,
        BattleError::ProposalFailed
    );
    p.executed = true;

    if p.kind == 0 {
        let v = p.value;
        match p.param {
            PARAM_VOTE_COST => cfg.vote_cost = v,
            PARAM_VOTE_SECS => cfg.vote_secs = v as i64,
            PARAM_INITIAL_SECS => cfg.initial_secs = v as i64,
            PARAM_OP_SHARE_BPS => cfg.op_share_bps = v as u16,
            PARAM_BOMB_KARMA => cfg.bomb_karma = v,
            PARAM_RESURRECT_KARMA => cfg.resurrect_karma = v,
            PARAM_COMMENT_THRESHOLD => cfg.comment_threshold = v as u32,
            PARAM_FAUCET_AMOUNT => cfg.faucet_amount = v,
            PARAM_VOTING_PERIOD => cfg.voting_period = v as i64,
            PARAM_QUORUM => cfg.quorum = v,
            PARAM_WITHDRAW_PENALTY => cfg.withdraw_penalty_secs = v as i64,
            _ => return err!(BattleError::InvalidParam),
        }
    } else {
        let dest = ctx
            .accounts
            .recipient_ata
            .as_ref()
            .ok_or(BattleError::MissingRecipient)?;
        require_keys_eq!(dest.owner, p.recipient, BattleError::InvalidTokenAccount);
        require_keys_eq!(dest.mint, cfg.time_mint, BattleError::InvalidTokenAccount);
        let signer: &[&[&[u8]]] = &[&[b"config", &[cfg.bump]]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: dest.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            p.value,
        )?;
    }
    Ok(())
}
