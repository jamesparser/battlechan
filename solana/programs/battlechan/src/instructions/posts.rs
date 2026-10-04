use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::BattleError;
use crate::state::*;

/// Puts `new_post` into the category ring buffer, archiving whichever post was in the slot.
pub fn bump_into_ring(
    category: &mut Category,
    victim: &mut Option<Account<Post>>,
    new_post: Pubkey,
) -> Result<()> {
    let idx = category.next as usize;
    let slot = category.slots[idx];
    if slot != Pubkey::default() {
        let v = victim.as_mut().ok_or(BattleError::WrongVictim)?;
        require_keys_eq!(v.key(), slot, BattleError::WrongVictim);
        v.archived = true;
    }
    category.slots[idx] = new_post;
    category.next = ((idx + 1) % CATEGORY_CAP) as u8;
    Ok(())
}

#[derive(Accounts)]
pub struct CreatePost<'info> {
    #[account(mut)]
    pub author: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"category", category.id.to_le_bytes().as_ref()], bump = category.bump
    )]
    pub category: Box<Account<'info, Category>>,
    #[account(
        mut, seeds = [b"profile", author.key().as_ref()], bump = profile.bump
    )]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(
        init, payer = author, space = 8 + Post::INIT_SPACE,
        seeds = [b"post", config.post_count.to_le_bytes().as_ref()], bump
    )]
    pub post: Box<Account<'info, Post>>,
    /// The post currently in the slot being overwritten (None while the ring is still filling).
    #[account(mut)]
    pub victim: Option<Account<'info, Post>>,
    pub system_program: Program<'info, System>,
}

pub fn create_post(
    ctx: Context<CreatePost>,
    title: String,
    body: String,
    media_uri: String,
    poll_options: Vec<String>,
) -> Result<()> {
    require!(!title.trim().is_empty(), BattleError::TextEmpty);
    require!(title.len() <= MAX_TITLE, BattleError::TextTooLong);
    require!(body.len() <= MAX_BODY, BattleError::TextTooLong);
    require!(media_uri.len() <= MAX_URI, BattleError::TextTooLong);
    if !poll_options.is_empty() {
        require!(
            poll_options.len() >= 2 && poll_options.len() <= MAX_POLL_OPTIONS,
            BattleError::InvalidPoll
        );
        for o in poll_options.iter() {
            require!(!o.is_empty() && o.len() <= MAX_POLL_OPTION_LEN, BattleError::InvalidPoll);
        }
    }

    let now = Clock::get()?.unix_timestamp;
    let post_key = ctx.accounts.post.key();
    bump_into_ring(&mut ctx.accounts.category, &mut ctx.accounts.victim, post_key)?;

    let cfg = &mut ctx.accounts.config;
    let p = &mut ctx.accounts.post;
    p.id = cfg.post_count;
    p.category = ctx.accounts.category.id;
    p.author = ctx.accounts.author.key();
    p.owner = ctx.accounts.author.key();
    p.created_at = now;
    p.expires_at = now + cfg.initial_secs;
    p.title = title;
    p.body = body;
    p.media_uri = media_uri;
    p.flair = 0;
    p.up_votes = 0;
    p.down_votes = 0;
    p.comment_count = 0;
    p.pot = 0;
    p.op_withdrawn = 0;
    p.commenter_paid = 0;
    p.qualified_likes = 0;
    p.burned_from_down = 0;
    p.dao_from_down = 0;
    p.archived = false;
    p.poll_options = poll_options;
    p.poll_votes = [0; 4];
    p.bump = ctx.bumps.post;

    cfg.post_count += 1;
    ctx.accounts.category.post_count += 1;
    ctx.accounts.profile.posts = ctx.accounts.profile.posts.saturating_add(1);
    Ok(())
}

#[derive(Accounts)]
pub struct CreateComment<'info> {
    #[account(mut)]
    pub commenter: Signer<'info>,
    #[account(
        mut, seeds = [b"profile", commenter.key().as_ref()], bump = profile.bump
    )]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump,
        constraint = !post.archived @ BattleError::PostArchived
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(
        init, payer = commenter, space = 8 + Comment::INIT_SPACE,
        seeds = [b"comment", post.key().as_ref(), post.comment_count.to_le_bytes().as_ref()], bump
    )]
    pub comment: Box<Account<'info, Comment>>,
    pub system_program: Program<'info, System>,
}

pub fn create_comment(
    ctx: Context<CreateComment>,
    body: String,
    media_uri: String,
) -> Result<()> {
    require!(!body.trim().is_empty() || !media_uri.is_empty(), BattleError::TextEmpty);
    require!(body.len() <= MAX_COMMENT, BattleError::TextTooLong);
    require!(media_uri.len() <= MAX_URI, BattleError::TextTooLong);

    let now = Clock::get()?.unix_timestamp;
    let post = &mut ctx.accounts.post;
    let c = &mut ctx.accounts.comment;
    c.post = post.key();
    c.author = ctx.accounts.commenter.key();
    c.index = post.comment_count;
    c.body = body;
    c.media_uri = media_uri;
    c.created_at = now;
    c.likes = 0;
    c.dislikes = 0;
    c.reward_claimed = 0;
    c.bump = ctx.bumps.comment;

    post.comment_count = post.comment_count.saturating_add(1);
    let prof = &mut ctx.accounts.profile;
    prof.comments = prof.comments.saturating_add(1);
    prof.last_comment_ts = now;
    Ok(())
}

#[derive(Accounts)]
pub struct PollVoteCtx<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(seeds = [b"profile", voter.key().as_ref()], bump = voter_profile.bump)]
    pub voter_profile: Box<Account<'info, UserProfile>>,
    #[account(mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump)]
    pub post: Box<Account<'info, Post>>,
    #[account(
        init, payer = voter, space = 8 + PollVote::INIT_SPACE,
        seeds = [b"pvote", post.key().as_ref(), voter.key().as_ref()], bump
    )]
    pub poll_vote: Box<Account<'info, PollVote>>,
    pub system_program: Program<'info, System>,
}

pub fn poll_vote(ctx: Context<PollVoteCtx>, option: u8) -> Result<()> {
    let post = &mut ctx.accounts.post;
    require!((option as usize) < post.poll_options.len(), BattleError::InvalidPollOption);
    post.poll_votes[option as usize] = post.poll_votes[option as usize].saturating_add(1);
    ctx.accounts.poll_vote.option = option;
    Ok(())
}

fn flair_price(id: u8) -> Result<u64> {
    require!(id >= 1 && id <= MAX_FLAIR_ID, BattleError::InvalidFlair);
    Ok(FLAIR_UNIT_PRICE * id as u64)
}

#[derive(Accounts)]
pub struct BuyPostFlair<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump,
        has_one = owner @ BattleError::Unauthorized
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(
        mut, token::mint = config.time_mint, token::authority = owner
    )]
    pub owner_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.treasury)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn buy_post_flair(ctx: Context<BuyPostFlair>, flair: u8) -> Result<()> {
    let price = flair_price(flair)?;
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.owner_ata.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        price,
    )?;
    ctx.accounts.post.flair = flair;
    Ok(())
}

#[derive(Accounts)]
pub struct BuyProfileDecoration<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [b"profile", user.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
    #[account(mut, token::mint = config.time_mint, token::authority = user)]
    pub user_ata: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.treasury)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn buy_profile_decoration(ctx: Context<BuyProfileDecoration>, decoration: u8) -> Result<()> {
    let price = flair_price(decoration)?;
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.user_ata.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        price,
    )?;
    ctx.accounts.profile.decoration = decoration;
    Ok(())
}

/// NFT-lite post trade: the current owner and a buyer co-sign one transaction. The buyer pays
/// `price` $TIME to the owner and receives the post plus all of its future pot withdrawals.
#[derive(Accounts)]
pub struct TradePost<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub owner: Signer<'info>,
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut, seeds = [b"post", post.id.to_le_bytes().as_ref()], bump = post.bump,
        has_one = owner @ BattleError::Unauthorized
    )]
    pub post: Box<Account<'info, Post>>,
    #[account(address = config.time_mint)]
    pub time_mint: Box<Account<'info, Mint>>,
    #[account(mut, token::mint = time_mint, token::authority = buyer)]
    pub buyer_ata: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed, payer = buyer,
        associated_token::mint = time_mint, associated_token::authority = owner
    )]
    pub owner_ata: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn trade_post(ctx: Context<TradePost>, price: u64) -> Result<()> {
    if price > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.owner_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            price,
        )?;
    }
    ctx.accounts.post.owner = ctx.accounts.buyer.key();
    Ok(())
}
