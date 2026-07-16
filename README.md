# Battlechan

**Status**: MVP Built (VPS) | **Difficulty**: 7/10 | **Profit**: 5/10  
**Website**: [vps-battlechan](https://rinem-tyaaa-aaaak-cgua-cai.icp0.io/) (testnet)  
**Kanban**: [See Kanban spreadsheet](https://docs.google.com/spreadsheets/d/1VGvR1qHqFuF7g4gjifjmKZfT3M1IUAxRXBAa83KdCzA/edit?usp=sharing)  
**GitHub**: `node0datasystems-lgtm/battlechan-project`

## What Is Battlechan

Controversial content platform on Solana with tokenized engagement mechanics. Posts have countdown timers — when time expires, they're archived (not deleted). Core revenue mechanic: every downvote burns 50% of the $TIME token and sends 50% to the team DAO. Controversial content literally prints money.

## Tech Stack
- **Blockchain**: Solana (Privy auth, ZK Compression, Token-2022)
- **Frontend**: Next.js (Web) + React Native (Mobile)
- **Auth**: Privy SDK (Google/Email login, embedded wallets)
- **Storage**: Cloudflare R2 (images), on-chain PDA threads
- **VPS**: 191.96.166.144:24003

## Tokenomics
- **$TIME**: Main utility token. Downvotes burn 50% + 50% to DAO. Posts expire → $TIME to OP (75%) + top commenters (25%).
- **$KARMA**: Earned on 5+ comment likes. Staking yields 3-10% $TIME APY. Bomb ($50 KARMA) reduces post time. Resurrect ($50 KARMA) restores archived posts.

## Phases
- **Phase 1**: ✅ Complete — mobile compat, plug/stoic wallets, archive system, token swap, NFT marketplace, downvote distribution
- **Phase 2**: In progress — $KARMA token, staking, bomb/resurrect mechanics, badge system
- **Phase 3**: Planned — NFT minting, AI assistance, AI moderation, AI user clones

## Key Insight
Bear market = bad time for token launch. But AI tokens still performing. Consider Node0 Utility Token instead of $TIME.

## Links
- [Project Spec](https://github.com/node0datasystems-lgtm/battlechan-project/blob/main/PROJECT_SPEC.md)
- [Crypto Analysis](https://github.com/node0datasystems-lgtm/battlechan-project/blob/main/CRYPTO_ANALYSIS.md)
- [Technical Checklist](https://github.com/node0datasystems-lgtm/battlechan-project/blob/main/TECHNICAL_CHECKLIST.md)
