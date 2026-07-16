# Battlechan — Project Document

**Last Updated:** 2026-06-15
**Status:** Benchmarks defined (Phase 1), core platform MVP built (vps-battlechan)

---

## What Is Battlechan

Battlechan is a controversial content platform on Solana with tokenized engagement mechanics. Posts have countdown timers — when time runs out, they're archived (not deleted). The core revenue mechanic: every downvote burns 50% of the $TIME token and sends 50% to the team DAO. Controversial content literally prints money.

> **Branding note:** Battlechan has no connection to, and must never reference, any prior projects or developers. This is a clean, original build under Node0 Data Systems.

**Live Instance:** vps-battlechan (191.96.166.144:24003) — WickBot v7 trading on Hyperliquid; VPS accessible via `id_battlechan` SSH key

**Related:** battlechan-crypto-analysis.md (why "build when profitable"), battlechan-solana-checklist.md (technical stack details)

---

## Product Roadmap — BattleChan Benchmarks 2025

Source: https://docs.google.com/document/d/166ExrlJ4-101QYnG83pNXak1JhHNq31Onx1uD3f0QY0/edit

---

### Phase 1 — Complete (Basic Functionality)

- [x] Mobile Device Compatibility
- [x] BattleChan Web Domain
- [x] Integration with Plug and Stoic Wallets
- [x] Post Visibility: posts stay visible in archive when timer expires (bumped to archive by newer posts)
- [x] Permanence of Content: comments/posts preserved in archive + user profiles with vote counts shown
- [x] Token Swap Link
- [x] NFT Marketplace Link
- [x] Withdraw $TIME Tokens:
  - 75% to original poster (OP)
  - 25% to top commenters with 5+ comment likes
- [x] $TIME Pots in UI:
  - Pot for OP (75% withdrawable)
  - Pot for top commenters (25%)
  - Pot showing DAO share (50% of downvotes)
  - Pot showing burn (50% of downvotes)
  - Visible on hover or within post UI
- [x] Downvote $TIME Distribution: 50% DAO, 50% burn
- [x] Unlimited Upvotes/Downvotes: users can engage repeatedly as long as they hold $TIME

**Note:** NFID verification to eliminate spam (to be added)

---

### Phase 2 — Enhance (User Engagement & Functionality)

#### $KARMA Token
- Earn 1 $KARMA each time your comment receives 5 likes
- Display: $KARMA balance, pending $TIME rewards on live posts, Time Balance page
- Show total $KARMA on user profile + total posts/comments
- Total supply: 1 Trillion tokens
- Spent $KARMA → DAO treasury

#### $KARMA Staking
- Auto-stake in Time Balance page (requires 1 comment/day to receive staking rewards)
- Badges increase $KARMA staking rewards
- Base APY: 3% $TIME annually
- Incremental badge bonuses: +1% to +3% per milestone
- Maximum APY: 10% annually (capped)

#### $KARMA Bomb 💣
- Bomb emoji next to upvote/downvote buttons
- Costs 50 staked $KARMA → reduces post time by 10 minutes
- Burns 5 $TIME + sends 5 $TIME to DAO (same as downvotes)
- Allows community censorship without needing $TIME tokens

#### $KARMA Resurrect 🕊️
- Dove emoji on archived posts
- Costs 50 staked $KARMA → adds 10 minutes to post time
- Allows community restoration of inappropriately censored/brigaded posts

#### Other Enhancements
- [ ] Share on X (Twitter) button for posts
- [ ] Referral rewards: referrer earns 1 $KARMA each time referred user earns 1 $KARMA
- [ ] Decorative elements: post flairs, profile decorations (purchased with $TIME)
- [ ] Dynamic platform themes (holidays/special events)
- [ ] Poll creation in posts
- [ ] GIF and WebM support in comments
- [ ] Community DAO governance: govern platform params, treasury, and dev

#### Badge System

**Join Date:**
- OG Badge 2025: users who joined in launch year

**Commenting Milestones:**
- 10, 50, 100, 1,000 comments

**Posting Milestones:**
- 10, 50, 100, 1,000 posts

**Wealth Badges (by $TIME balance):**
- 🦐 Shrimp: 0–10
- 🦀 Crab: >10
- 🐙 Octopus: >1,000
- 🐟 Fish: >10,000
- 🐬 Dolphin: >100,000
- 🦈 Shark: >1,000,000
- 🐋 Whale: >100,000,000
- 🐋‍🐋 Humpback: >1,000,000,000

**Popularity Milestones:**
- Post Likes: 100, 1,000
- Comment Likes: 100, 1,000
- Comment Downvotes: 100, 1,000

---

### Phase 3 — Innovate (Cutting-Edge Features)

- [ ] **Mint Posts as NFTs:** users can mint posts, buyers own post + can withdraw accrued $TIME
- [ ] **AI Post/Comment Assistance:** AI helps generate high-quality posts and comments
- [ ] **AI Graphic Generation:** AI creates images for posts/comments
- [ ] **AI User Clones:** AI instance modeled after user's post/comment history — for interaction or export to games/metaverse
- [ ] **AI Moderation for Adult Content:** AI-powered filter toggled on/off; removes adult images, WebMs, GIFs

---

## Technical Architecture (from Solana Checklist)

- **Privy SDK:** Google/Email login, embedded wallets (no Phantom needed)
- **Session Keys:** 24-hour session without wallet popups for upvote/downvote
- **ZK Compression (Light Protocol):** ~$0.002/user vs $2.00 normal
- **Gas Sponsorship (Paymaster):** Team pays tiny SOL so users feel "free"
- **PDA Thread Vaults:** Threads as PDAs holding tokens = minutes remaining
- **Auto-Cleanup:** Timer hits 0 → thread deleted → SOL rent returned to Team Wallet
- **Token-2022 Tax:** 50% burn + 50% team fee on downvotes
- **Text Storage:** Directly in PDA (no Arweave)
- **Image Storage:** Link on-chain, files on Cloudflare R2
- **Frontend:** Next.js (Web) + React Native (Mobile)

---

## $TIME Tokenomics Summary

| Action | Effect |
|---|---|
| Upvote | No token cost (free engagement) |
| Downvote | 50% burns, 50% to DAO |
| Post Timer Expires | $TIME goes to OP (75%) + top commenters (25%) |
| $KARMA Bomb | 5 $TIME burned + 5 $TIME to DAO |
| $KARMA Resurrect | Same as bomb but reverses post time |

---

## SNS DAO Launch

SNS DAO token launch planned for later — governance + treasury to be community-controlled post-launch.

---

*Owned by Node0 Data Systems Co., Ltd. (AgentAsia brand)*
