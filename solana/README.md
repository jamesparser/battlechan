# BattleChan on Solana

Posts battle for time. Every post starts with 5 free minutes on the clock. Upvoting a post (👍) costs 1 $TIME and adds 1 minute; downvoting (💩) costs 1 $TIME and removes 1 minute. Comment likes are free.
Only 20 posts live per category; newer posts bump the oldest into a permanent archive. Port of the Internet Computer
version, built from the *BattleChan Benchmarks 2025* and *Whitepaper* docs.

## What's implemented (on-chain, Anchor 0.31)

| Feature (from the docs) | Where |
|---|---|
| 5-min start, ±1 min per $TIME vote; 125 live posts per category (oldest bumped to archive); page 1 = 25 posts, page 2 = 100; 🔞 `report_post` | `upvote_post`, `downvote_post`, `report_post` |
| 20 live posts per category, bump-to-archive; expired posts stay visible until bumped | `Category.slots` ring buffer, `create_post` |
| Permanent archive + profile history, up/down counts kept | `Post` accounts are never closed |
| Upvote $TIME → pot: 75% owner / 25% commenters with 5+ likes (pro-rata) | `op_withdraw`, `claim_comment_reward` |
| Downvote $TIME: 50% burned, 50% DAO treasury; pots visible on hover | `downvote_post`, `Pots` component |
| Fixed 100B $TIME (40% DAO, 20% incentives, 40% team/advisors/marketing), mint authority revoked | `initialize` |
| $KARMA is a **real SPL token** (6 decimals, 1T cap, program-only mint). 1 per 5 comment likes, minted into the staking vault (auto-stake); `stake_karma` / `unstake_karma` move it to/from your wallet; spent karma goes to the DAO karma treasury | `vote_comment`, `stake_karma`, `unstake_karma` |
| Staking: 3% base APY, +1–3% per milestone badge, 10% cap, daily comment required | `claim_staking_rewards` |
| Karma bomb (-10 min, burns/DAOs 5 $TIME from treasury), Resurrect (+10 min) | `karma_bomb`, `karma_resurrect` |
| Referrals (referrer gets +1 karma whenever referee does) | `create_profile`, `award_karma` |
| Flair + profile decorations bought with $TIME | `buy_post_flair`, `buy_profile_decoration` |
| Polls | `create_post(poll_options)`, `poll_vote` |
| NFT-lite post ownership trade (owner + buyer co-sign) | `trade_post` |
| DAO: parameter proposals + treasury spends, token-weighted | `create_proposal`, `dao_vote`, `execute_proposal` |
| Badges (OG, comment/post milestones, wealth ladder, popularity) | derived in `app/src/lib/badges.ts` from on-chain counters |
| Faucet (testnet airdrop pool, 1/day) | `faucet` |

Frontend extras: mobile layout, Phantom/Solflare, share-on-X, GIF/WebM/image links in posts and comments,
media blur toggle, seasonal themes, swap + NFT-market links (set in `app/.env`).

## Deploy to Solana testnet

```bash
# prerequisites: solana CLI (Agave 2.x), anchor 0.31.1, node 18+
solana-keygen new            # if you have no wallet
solana config set --url testnet
solana airdrop 2             # repeat / use https://faucet.solana.com until you have ~6 SOL

npm install
npm run deploy:testnet       # anchor keys sync + build + deploy + initialize + seed categories

cd app && cp .env.example .env && npm install && npm run dev
```

`target/deploy/battlechan-keypair.json` is a pre-generated program keypair so the program id
(`J4FZnCJRHErXyzK677xbiEURnQ5rf5Js7w47eJaMu2CD`) is stable. For a hosted frontend: `cd app && npm run build`
and deploy `app/dist` (Cloudflare Pages / Vercel). Testnet is flaky; if deploys fail, switch to devnet
(`Anchor.toml`, `app/.env`, scripts) — nothing else changes.

## $TIME / $KARMA liquidity (future)

Both tokens are standard SPL mints with 6 decimals, so a $TIME/$KARMA pool (or either against SOL/USDC) can be opened on
Raydium / Orca / Meteora on mainnet once you are ready. Unstake karma to your wallet to hold or LP it. Testnet has no
production DEXes, so LP is a mainnet step.

## Tests

`tests/battlechan.ts` is an Anchor localnet integration suite (supply/mint revoke, faucet cooldown, vote timing,
50/50 burn/DAO split, karma + commenter payout, 20-slot ring). Run with `anchor test`.

## Honest status

* The Rust program compiles (`cargo check`), the IDL builds (`anchor idl build`), the frontend type-checks and builds.
* **The program has not been executed on a validator yet.** The environment I built in could not download the Solana
  SBF toolchain, so `anchor build` and `anchor test` were not run. Expect to fix small account-constraint issues on
  first run; run `anchor test` first.
* Not built: AI features (post/comment assist, image gen, user clones, AI adult filter — UI has a media-blur toggle only),
  real Metaplex NFT minting (posts are tradable via `trade_post`), Plug/Stoic wallets (ICP-only; replaced by Phantom/Solflare).
* DAO vote weight is the $TIME balance at vote time (no snapshot), so tokens could be moved to vote twice. Fine for a demo.
* UI layout follows the Miro wireframes (4-column post grid, ⭐ Buy $TIME, sort by rank, create post, dashboard, day/night mode, hover pots); the Miro comment threads were not readable in view-only mode.
* The feed uses `getProgramAccounts` (fine for a demo; add an indexer for scale).
* I could not read the Miro board or the ICP canister source; reconcile against them.
