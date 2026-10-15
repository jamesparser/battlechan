# BattleChan on Solana

Posts battle for time. Every post starts with 5 free minutes on the clock. Upvoting a post (👍) costs 1 $TIME and adds 60 seconds; downvoting (💩) costs 1 $TIME and removes 60 seconds (implemented 50% burn / 50% DAO treasury). Comment likes are free. Only 125 posts live per category; newer posts bump the oldest into a permanent archive. Port of the Internet Computer version, built from the *BattleChan Benchmarks 2025* and *Whitepaper* docs and the owner's Miro wireframe rules.

## What's implemented (on-chain, Anchor 0.31)

| Feature | Where |
|---|---|
| 5-min start, ±60 s per $TIME vote; 125 live posts per category (oldest bumped to archive); page 1 = 25 posts, page 2 = 100; 🔞 `report_post` | `upvote_post`, `downvote_post`, `report_post`, `Category.slots` ring buffer |
| Permanent archive + profile history; posts never deleted | `Post` accounts persist |
| Vote pots: 75% owner / 25% commenters with 5+ likes (pro-rata) | `op_withdraw`, `claim_comment_reward` |
| Downvote $TIME: 50% burned, 50% DAO treasury | `downvote_post`, `Pots` component |
| Fixed 100B $TIME (6 decimals), mint authority revoked | `initialize` |
| $KARMA = real SPL token (6 decimals, 1T cap, program-only mint). 1 per 5 comment likes, auto-staked; `stake_karma`/`unstake_karma` | `vote_comment`, `stake_karma`, `unstake_karma` |
| Staking: 3% base APY → 10% cap (milestones + daily comment) | `claim_staking_rewards` |
| Karma bomb (−10 min) and Resurrect (+10 min), 50 $KARMA each | `karma_bomb`, `karma_resurrect` |
| Referrals (referrer +1 karma), flair + profile decorations | `create_profile`, `buy_post_flair`, `buy_profile_decoration` |
| Polls, NFT-lite post trade, DAO proposals/spends (token-weighted) | `create_post(poll_options)`, `poll_vote`, `trade_post`, `create_proposal`, `dao_vote`, `execute_proposal` |
| Fallback faucet (100 $TIME / day / user) | `faucet` |

Frontend extras: mobile layout, Phantom/Solflare, share-on-X, GIF/WebM/link media, blur toggle, themes, Badges, swap/NFT links (set in `app/.env`).

## Deploy to Solana devnet

```bash
# prerequisites: solana CLI (Agave 2.x), anchor 0.31.1, node 18+
solana-keygen new              # if you have no wallet
solana config set --url devnet
solana airdrop 5               # ~6 SOL needed; use https://faucet.solana.com if rate-limited
npm install
bash scripts/deploy-devnet.sh  # anchor keys sync + build + deploy + initialize + seed categories

cd app && cp .env.example .env && npm install && npm run dev
```

Program id: **`FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk`**
(keypair: `target/deploy/battlechan-keypair.json` — never commit this file.)

For a hosted frontend: `cd app && npm run build` and deploy `app/dist` (Vercel / Cloudflare Pages).
Frontend expects `VITE_CLUSTER`/`VITE_RPC` in `app/.env` (defaults: devnet).

## $TIME / $KARMA liquidity (future)

Both tokens are standard SPL mints (6 decimals), so a $TIME/KARMA (or either vs SOL/USDC) pool can be opened on
Raydium / Orca / Meteora on mainnet when ready. Unstake karma to your wallet to hold or LP it. Devnet has no
production DEXes, so LP is a mainnet step.

## Tests

`tests/battlechan.ts` is an Anchor localnet integration suite. Run with `anchor test` (spins up a local validator).

**Status: 6/6 passing** — covers fixed supply + revoked mint authority, onboarding + faucet cooldown,
post start time + upvote pot + downvote 50% burn, $KARMA on comment likes, owner withdraw limits,
and the 125-slot ring-buffer archive + karma resurrect.

## Honest status

* ✅ `anchor build` (SBF) succeeds — the `Category` account uses a heap-`Vec` slot ring (a `[Pubkey;125]`
  array blows the 4096-byte SBF stack frame).
* ✅ `anchor test`: 6/6 pass on a local validator.
* ✅ Frontend `npm run build` (tsc + vite) succeeds, wired to the fresh IDL and program id.
* ✅ **Live on Solana devnet.** Program `FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk`
  (deploy completed 2026-10-05). `init.ts` created config, 7 seeded categories, admin profile, and both mints.
* ✅ Frontend rebuilt with the fresh IDL and pointed at devnet: **https://battlechan.vercel.app**
  (Vercel Authentication off — open to judges).

### Live addresses (devnet)

| Item | Address |
|---|---|
| Program | [`FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk`](https://explorer.solana.com/address/FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk?cluster=devnet) |
| $TIME mint | [`6Y8Z92BoLsaEUkYFCoxC391ZKETbmwoYWw1D9iWscLwi`](https://explorer.solana.com/address/6Y8Z92BoLsaEUkYFCoxC391ZKETbmwoYWw1D9iWscLwi?cluster=devnet) — 100B supply, 6 decimals, mint authority revoked |
| $KARMA mint | [`FQczvmprTFaAuocypJe5ePNEocoARUkdT8Ed9rQNY3Gm`](https://explorer.solana.com/address/FQczvmprTFaAuocypJe5ePNEocoARUkdT8Ed9rQNY3Gm?cluster=devnet) — 1T cap, program-minted |
| Frontend | https://battlechan.vercel.app |
* Not built: AI features (post/comment assist, image gen, user clones, adult filter — media-blur toggle only),
  real Metaplex NFT minting (posts trade via `trade_post`), Plug/Stoic wallets (ICP-only; replaced by Phantom/Solflare).
* DAO vote weight is $TIME balance at vote time (no snapshot) — fine for a demo.
* Feed uses `getProgramAccounts` (fine for a demo; add an indexer for scale).
