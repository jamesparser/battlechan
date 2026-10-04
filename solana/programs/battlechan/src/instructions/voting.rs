use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::BattleError;
use crate::state::*;

#[derive(Accounts)]
pub struct UpvotePost<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump,
        constraint = !post.archived @ BattleError::PostArchived
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(
        mut, seeds = [b"profile", post.author.as_ref()], bump = author_profile.bump
    )]
    pub author_profile: Box<Account<'info, UserProfile>>,
    #[account(mut, token::mint = config.time_mint, token::authority = voter)]
    pub voter_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Spend `votes * vote_cost` $TIME to add `votes * vote_secs` to the post's timer.
/// All upvote $TIME goes into the post pot (75% OP / 25% top commenters).
pub fn upvote_post(ctx: Context<UpvotePost>, votes: u32) -> Result<()> {
    require!(votes > 0, BattleError::ZeroVotes);
    let cfg = &ctx.accounts.config;
    let amount = cfg
        .vote_cost
        .checked_mul(votes as u64)
        .ok_or(BattleError::MathOverflow)?;
    let secs = cfg
        .vote_secs
        .checked_mul(votes as i64)
        .ok_or(BattleError::MathOverflow)?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.voter_ata.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.voter.to_account_info(),
            },
        ),
        amount,
    )?;

    let post = &mut ctx.accounts.post;
    post.up_votes = post.up_votes.saturating_add(votes as u64);
    post.pot = post.pot.checked_add(amount).ok_or(BattleError::MathOverflow)?;
    post.expires_at = post.expires_at.checked_add(secs).ok_or(BattleError::MathOverflow)?;

    let ap = &mut ctx.accounts.author_profile;
    ap.max_post_up_votes = ap.max_post_up_votes.max(post.up_votes);
    Ok(())
}

#[derive(Accounts)]
pub struct DownvotePost<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump,
        constraint = !post.archived @ BattleError::PostArchived
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(mut, address = config.time_mint)]
    pub time_mint: Box<Account<'info, Mint>>,
    #[account(mut, token::mint = time_mint, token::authority = voter)]
    pub voter_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.treasury)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Spend `votes * vote_cost` $TIME; 50% is burned, 50% goes to the DAO treasury.
/// The post timer is shortened by `votes * vote_secs`.
pub fn downvote_post(ctx: Context<DownvotePost>, votes: u32) -> Result<()> {
    require!(votes > 0, BattleError::ZeroVotes);
    let cfg = &ctx.accounts.config;
    let amount = cfg
        .vote_cost
        .checked_mul(votes as u64)
        .ok_or(BattleError::MathOverflow)?;
    let secs = cfg
        .vote_secs
        .checked_mul(votes as i64)
        .ok_or(BattleError::MathOverflow)?;
    let burn_amt = amount / 2;
    let dao_amt = amount - burn_amt;

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.time_mint.to_account_info(),
                from: ctx.accounts.voter_ata.to_account_info(),
                authority: ctx.accounts.voter.to_account_info(),
            },
        ),
        burn_amt,
    )?;
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.voter_ata.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
                authority: ctx.accounts.voter.to_account_info(),
            },
        ),
        dao_amt,
    )?;

    let post = &mut ctx.accounts.post;
    post.down_votes = post.down_votes.saturating_add(votes as u64);
    post.expires_at = post.expires_at.checked_sub(secs).ok_or(BattleError::MathOverflow)?;
    post.burned_from_down = post.burned_from_down.saturating_add(burn_amt);
    post.dao_from_down = post.dao_from_down.saturating_add(dao_amt);

    let cfg = &mut ctx.accounts.config;
    cfg.total_burned = cfg.total_burned.saturating_add(burn_amt);
    cfg.total_to_dao = cfg.total_to_dao.saturating_add(dao_amt);
    Ok(())
}

/// Mint 1 $KARMA (real SPL token) into the staking vault for the author, and 1 for their referrer.
/// Returns the number of base units to mint (caller performs the CPI), respecting the 1T cap.
pub fn award_karma(
    cfg: &mut Config,
    author: &mut UserProfile,
    referrer: &mut Option<Account<UserProfile>>,
) -> Result<u64> {
    let mut total: u64 = 0;
    if cfg.karma_minted.saturating_add(KARMA_UNIT) <= KARMA_CAP {
        author.karma = author.karma.saturating_add(KARMA_UNIT);
        author.karma_lifetime = author.karma_lifetime.saturating_add(KARMA_UNIT);
        cfg.karma_minted += KARMA_UNIT;
        total += KARMA_UNIT;
        if let Some(expected) = author.referrer {
            let r = referrer.as_mut().ok_or(BattleError::ReferrerRequired)?;
            require_keys_eq!(r.authority, expected, BattleError::InvalidReferrer);
            if cfg.karma_minted.saturating_add(KARMA_UNIT) <= KARMA_CAP {
                r.karma = r.karma.saturating_add(KARMA_UNIT);
                r.karma_lifetime = r.karma_lifetime.saturating_add(KARMA_UNIT);
                cfg.karma_minted += KARMA_UNIT;
                total += KARMA_UNIT;
            }
        }
    }
    Ok(total)
}

#[derive(Accounts)]
pub struct VoteComment<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(seeds = [b"profile", voter.key().as_ref()], bump = voter_profile.bump)]
    pub voter_profile: Box<Account<'info, UserProfile>>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(
        mut,
        seeds = [b"comment", post.key().as_ref(), comment.index.to_le_bytes().as_ref()],
        bump = comment.bump,
        constraint = comment.post == post.key()
    )]
    pub comment: Box<Account<'info, Comment>>,
    #[account(
        mut, seeds = [b"profile", comment.author.as_ref()], bump = author_profile.bump
    )]
    pub author_profile: Box<Account<'info, UserProfile>>,
    /// Required (and checked) when the comment author was referred by someone.
    #[account(mut)]
    pub referrer_profile: Option<Account<'info, UserProfile>>,
    #[account(mut, address = config.karma_mint)]
    pub karma_mint: Box<Account<'info, Mint>>,
    #[account(mut, address = config.karma_vault)]
    pub karma_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    #[account(
        init, payer = voter, space = 8 + CommentVote::INIT_SPACE,
        seeds = [b"cvote", comment.key().as_ref(), voter.key().as_ref()], bump
    )]
    pub comment_vote: Box<Account<'info, CommentVote>>,
    pub system_program: Program<'info, System>,
}

/// Free like / dislike (one per wallet per comment). Every `comment_threshold` likes mints
/// 1 $KARMA token (auto-staked) to the author, and 1 to their referrer.
pub fn vote_comment(ctx: Context<VoteComment>, up: bool) -> Result<()> {
    require_keys_neq!(
        ctx.accounts.comment.author,
        ctx.accounts.voter.key(),
        BattleError::SelfVote
    );
    ctx.accounts.comment_vote.up = up;

    let threshold = ctx.accounts.config.comment_threshold.max(1);
    let comment = &mut ctx.accounts.comment;
    let author_profile = &mut ctx.accounts.author_profile;

    if up {
        comment.likes = comment.likes.saturating_add(1);
        author_profile.max_comment_likes = author_profile.max_comment_likes.max(comment.likes);

        let post = &mut ctx.accounts.post;
        if comment.likes == threshold {
            post.qualified_likes = post.qualified_likes.saturating_add(threshold as u64);
        } else if comment.likes > threshold {
            post.qualified_likes = post.qualified_likes.saturating_add(1);
        }

        if comment.likes % threshold == 0 {
            let minted = award_karma(
                &mut ctx.accounts.config,
                author_profile,
                &mut ctx.accounts.referrer_profile,
            )?;
            if minted > 0 {
                let bump = ctx.accounts.config.bump;
                let signer: &[&[&[u8]]] = &[&[b"config", &[bump]]];
                token::mint_to(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        token::MintTo {
                            mint: ctx.accounts.karma_mint.to_account_info(),
                            to: ctx.accounts.karma_vault.to_account_info(),
                            authority: ctx.accounts.config.to_account_info(),
                        },
                        signer,
                    ),
                    minted,
                )?;
            }
        }
    } else {
        comment.dislikes = comment.dislikes.saturating_add(1);
        author_profile.max_comment_dislikes =
            author_profile.max_comment_dislikes.max(comment.dislikes);
    }
    Ok(())
}
