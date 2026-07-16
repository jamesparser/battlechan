# Battlechan Solana Tech Checklist
From: user's saved research, for building battlechan social network

## Architecture
- **Privy SDK**: Google/Email login, embedded wallets (invisible wallets, no Phantom needed)
- **Session Keys**: 24-hour session without wallet popups for upvote/downvote
- **ZK Compression (Light Protocol)**: $0.002 per user vs $2.00 normal
- **Gas Sponsorship (Paymaster)**: Team pays tiny SOL fee so users feel "free"
- **PDA Thread Vaults**: Threads as PDAs holding tokens = minutes remaining
- **Auto-Cleanup**: When timer hits 0, thread deleted, SOL rent returned to Team Wallet
- **Token-2022 Tax**: 50% Burn + 50% Team Fee on downvotes

## Content Storage
- Text: Directly in PDA (no Arweave)
- Images: Link on-chain, files on Cloudflare R2

## Frontend
- Next.js (Web) + React Native (Mobile), same Privy logic

## Mobile App Concept
- 100 topics, scraped from Reddit, Twitter, news for keywords
- User selects topics to follow
- Hourly updates + market sentiment/analysis from free API keys
