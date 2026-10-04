use anchor_lang::prelude::*;

#[error_code]
pub enum BattleError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Text too long")]
    TextTooLong,
    #[msg("Text is empty")]
    TextEmpty,
    #[msg("Invalid poll configuration")]
    InvalidPoll,
    #[msg("Post is archived")]
    PostArchived,
    #[msg("Post is not archived")]
    PostNotArchived,
    #[msg("Wrong victim account for the category slot being bumped")]
    WrongVictim,
    #[msg("Not enough $KARMA")]
    NotEnoughKarma,
    #[msg("Vote count must be greater than zero")]
    ZeroVotes,
    #[msg("Cannot vote on your own comment")]
    SelfVote,
    #[msg("Nothing to withdraw")]
    NothingToWithdraw,
    #[msg("Initial visibility period has not ended")]
    TooEarly,
    #[msg("Comment is not eligible for rewards")]
    NotEligible,
    #[msg("Faucet cooldown active")]
    FaucetCooldown,
    #[msg("Staking rewards require a comment within the last 24h")]
    NeedDailyComment,
    #[msg("Invalid category")]
    InvalidCategory,
    #[msg("Invalid poll option")]
    InvalidPollOption,
    #[msg("Invalid referrer")]
    InvalidReferrer,
    #[msg("Referrer profile required")]
    ReferrerRequired,
    #[msg("Invalid flair id")]
    InvalidFlair,
    #[msg("Voting is closed")]
    VotingClosed,
    #[msg("Voting is still open")]
    VotingOpen,
    #[msg("Proposal already executed")]
    AlreadyExecuted,
    #[msg("Proposal did not pass")]
    ProposalFailed,
    #[msg("Insufficient $TIME to do that")]
    InsufficientTime,
    #[msg("Invalid parameter")]
    InvalidParam,
    #[msg("Missing recipient account")]
    MissingRecipient,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
}
