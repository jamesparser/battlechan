//! Protocol-level constants. Tunable values live in `Config` and are DAO-governed.

/// Max number of live posts per category (the "battle" arena).
pub const CATEGORY_CAP: usize = 20;
/// $TIME has 6 decimals.
pub const TIME_DECIMALS: u8 = 6;
pub const TIME_UNIT: u64 = 1_000_000;
/// 100 billion $TIME, fixed supply minted once at initialize, then mint authority is revoked.
pub const TIME_TOTAL_SUPPLY: u64 = 100_000_000_000 * TIME_UNIT;
/// $KARMA is a real SPL token with 6 decimals (so it can be paired with $TIME in an LP later).
pub const KARMA_DECIMALS: u8 = 6;
pub const KARMA_UNIT: u64 = 1_000_000;
/// 1 trillion $KARMA hard cap (base units), enforced by the program (mint authority is a PDA).
pub const KARMA_CAP: u64 = 1_000_000_000_000 * KARMA_UNIT;

pub const SECONDS_PER_DAY: i64 = 86_400;
pub const SECONDS_PER_YEAR: u128 = 31_536_000;

/// Staking APY (basis points).
pub const BASE_APY_BPS: u64 = 300; // 3%
pub const MAX_APY_BPS: u64 = 1_000; // 10%

pub const MAX_TITLE: usize = 80;
pub const MAX_BODY: usize = 1000;
pub const MAX_URI: usize = 200;
pub const MAX_COMMENT: usize = 500;
pub const MAX_POLL_OPTIONS: usize = 4;
pub const MAX_POLL_OPTION_LEN: usize = 40;
pub const MAX_CATEGORY_NAME: usize = 24;
pub const MAX_PROPOSAL_TITLE: usize = 64;
pub const MAX_PROPOSAL_DESC: usize = 256;

/// Flair / decoration price per id, in whole $TIME (price = id * FLAIR_UNIT_PRICE).
pub const FLAIR_UNIT_PRICE: u64 = 10 * TIME_UNIT;
pub const MAX_FLAIR_ID: u8 = 8;

/// Maximum accrual window for staking rewards in a single claim.
pub const MAX_STAKE_WINDOW_SECS: i64 = 30 * SECONDS_PER_DAY;

/// DAO parameter ids for `kind = 0` proposals.
pub const PARAM_VOTE_COST: u8 = 0;
pub const PARAM_VOTE_SECS: u8 = 1;
pub const PARAM_INITIAL_SECS: u8 = 2;
pub const PARAM_OP_SHARE_BPS: u8 = 3;
pub const PARAM_BOMB_KARMA: u8 = 4;
pub const PARAM_RESURRECT_KARMA: u8 = 5;
pub const PARAM_COMMENT_THRESHOLD: u8 = 6;
pub const PARAM_FAUCET_AMOUNT: u8 = 7;
pub const PARAM_VOTING_PERIOD: u8 = 8;
pub const PARAM_QUORUM: u8 = 9;
pub const PARAM_WITHDRAW_PENALTY: u8 = 10;
