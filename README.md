# Battlechan

**Posts battle for time.** A timed-discussion SocialFi imageboard on Solana — 4chan/Reddit/X energy with onchain economics.

Every post starts with **5 free minutes**. Upvote (👍) costs 1 $TIME and adds 60s. Downvote (💩) costs 1 $TIME and removes 60s (50% burned, 50% to the DAO). When the clock hits zero the post expires and is bumped to a permanent archive. Only **125 live posts** per category.

Built for **Colosseum Crypto World's Fair** (Sept 14 – Oct 12, 2026) · **Solana track** · Category: Social / SocialFi.

## Live demo

- **App:** https://battlechan.vercel.app (Solana **devnet** — connect Phantom or Solflare)
- **Program:** [`FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk`](https://explorer.solana.com/address/FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk?cluster=devnet)
- **$TIME mint:** [`6Y8Z92BoLsaEUkYFCoxC391ZKETbmwoYWw1D9iWscLwi`](https://explorer.solana.com/address/6Y8Z92BoLsaEUkYFCoxC391ZKETbmwoYWw1D9iWscLwi?cluster=devnet)
- **$KARMA mint:** [`FQczvmprTFaAuocypJe5ePNEocoARUkdT8Ed9rQNY3Gm`](https://explorer.solana.com/address/FQczvmprTFaAuocypJe5ePNEocoARUkdT8Ed9rQNY3Gm?cluster=devnet)

## Code layout

| Path | What |
|---|---|
| `solana/programs/battlechan/` | Anchor/Rust program (24 instructions) |
| `solana/app/` | Vite + React 18 + TypeScript frontend |
| `solana/tests/` | Anchor localnet suite (6/6 passing) |
| `solana/scripts/` | `deploy-devnet.sh`, `init.ts` |
| `solana/README.md` | Full architecture + tokenomics + known limitations |

## Tokenomics (short)

| Token | Supply | Role |
|---|---|---|
| **$TIME** | 100B fixed, 6 dec, mint revoked | Post clock (votes spend $TIME to add/remove time). Downvotes: 50% burn / 50% DAO. Pots: 75% creator / 25% top commenters. |
| **$KARMA** | 1T cap, program-minted | Earned from comment likes (1 per 5 likes). Staking 3–10% APY. Bomb 💣 (−10 min) / Resurrect 🕊️ (+10 min). |

## Team

- **Jason Parser Security** — [@jasonparsersec](https://x.com/jasonparsersec)
- Crypto development since 2017 · AI + Blockchain specialization

## Honest status

- ✅ Live on Solana **devnet** with real program + tokens (not mock data)
- ✅ `anchor test` 6/6
- ✅ Frontend wired to live IDL / program
- ⚠️ DAO vote weight is balance-at-vote-time (no snapshot)
- ⚠️ NFT mint is roadmap (`trade_post` works); AI features from Phase 3 not built
- Devnet is intentional for the hackathon window; architecture is mainnet-ready

See `solana/README.md` for the full picture.
