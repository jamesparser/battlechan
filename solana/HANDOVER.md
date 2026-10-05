# BattleChan (Solana) — Handover for the Mimo agent

Written 2026-10-05 by Claude (Cowork). Owner: Casey (node0datasystems-lgtm). Goal: hackathon submission of BattleChan on Solana testnet.

## 1. What BattleChan is
A time-boxed, token-curated imageboard. Posts "battle for time": every post starts with 5 free minutes; spending $TIME adds or removes minutes; when the clock hits zero the post expires and is eventually bumped to a permanent archive. Originally built on the Internet Computer; this is the Solana rebuild. The UI must look like the owner's Miro wireframe board (https://miro.com/app/board/uXjVP3qEKNQ=/, view-only; comment bubbles contain rules).

## 2. Where everything lives
- GitHub: `node0datasystems-lgtm/battlechan-project`, branch **`solana-port`** (private). Latest pushed commit at handover: `f23be70`. Earlier: `2db13c5` (first port), `08a3f6d3` (Miro-style rebuild), `77eb384` (logo + demo mode).
- Local (owner's Mac): `/Users/terminal/Developer/battlechan-github-mirror/solana/`
- Layout: `programs/battlechan/` (Anchor/Rust), `tests/battlechan.ts`, `scripts/init.ts`, `scripts/deploy-testnet.sh`, `app/` (Vite + React 18 + TS frontend), `README.md`.
- Live site: https://battlechan.vercel.app (Vercel project `battlechan`, team `node0datasystems-3141s-projects`). Vercel Authentication is ON, so only the owner (signed in) can open it. **For judges, turn it off** (Project → Settings → Deployment Protection → Vercel Authentication off).
- A zip of the whole project was also delivered in the chat as `battlechan-solana.zip` (older snapshot; the repo is newer).
- GitHub auth on the Mac: `gh` is logged in as node0datasystems-lgtm. If `git push` says "Repository not found", run `gh auth setup-git` first. The Mac's `device_bash` shell has no git credentials, but `osascript do shell script` runs as the real user and does.

## 3. Program (Anchor 0.31.1)
- Program id: `J4FZnCJRHErXyzK677xbiEURnQ5rf5Js7w47eJaMu2CD` (change it everywhere if the deploy keypair differs: `declare_id!`, `Anchor.toml`, `app/.env.example`, frontend constant in `app/src/lib/chain.ts`).
- 24 instructions: initialize, create_category, create_profile, faucet, create_post, create_comment, poll_vote, buy_post_flair, buy_profile_decoration, trade_post, report_post, upvote_post, downvote_post, vote_comment, op_withdraw, claim_comment_reward, claim_staking_rewards, karma_bomb, karma_resurrect, stake_karma, unstake_karma, create_proposal, dao_vote, execute_proposal.
- Tokens (both real SPL, 6 decimals):
  - **$TIME**: fixed 100B supply (40% DAO treasury / 20% faucet pool / 40% admin), mint authority revoked.
  - **$KARMA**: 1T cap, mintable only by the program, auto-staked into `karma_vault`; spent karma goes to `karma_treasury`.
- Rules (owner's Miro rules override the older docs):
  - New post: 5 free minutes.
  - 👍 post upvote costs 1 $TIME, adds 60 s. 💩 downvote costs 1 $TIME, removes 60 s (implemented as 50% burn / 50% DAO; the Miro comment says "burned" — either is defensible, state which one you ship).
  - Comment like/dislike is **free**.
  - 125 live posts per category (ring buffer); the oldest is bumped into the archive. Expired posts stay visible until bumped.
  - UI paging: page 1 = 25 posts, page 2 = 100. Sort by Rank or New.
  - Pots: 75% creator / 25% commenters with ≥5 likes (pro-rata). Creator can withdraw from the clock pop-up; each token withdrawn also removes a minute (`withdraw_penalty_secs` = 60).
  - $KARMA: 1 earned per 5 comment likes (referrer +1). Staking APY 3% base, up to 10%, daily comment required. 💣 bomb (50 karma, −10 min), 🕊️ resurrect (50 karma, +10 min).
  - Header icons on a post: 👍 like, 💩 dislike, 💸 tip (plain SPL transfer), 🐥 tweet, 🔞 report-to-admin.
  - DAO proposals (param change / treasury spend), polls, flair/profile decorations, faucet, NFT-lite `trade_post`. "Mint NFT" button is intentionally disabled (roadmap).
- Defaults set in `initialize`: initial_secs=300, vote_secs=60, vote_cost=1 $TIME, op_share_bps=7500, bomb/resurrect=50 KARMA, faucet 100 $TIME/day.

## 4. What is VERIFIED vs NOT
Verified (in Claude's cloud sandbox):
- Rust program passes `cargo check`; `anchor idl build` works (cargo shim + `RUSTC_BOOTSTRAP=1`); IDL at `target/idl/battlechan.json` and `app/src/idl/battlechan.json`.
- Frontend `npm run build` succeeds; rendered and screenshotted in desktop, mobile, night, thread view.

NOT verified (Claude had no Solana/Anchor toolchain or validator):
- `anchor build` (SBF) — possible stack-size issue with the big `Category` account (`[Pubkey;125]`); consider `Box<Account<..>>` or zero_copy.
- `anchor test` — `tests/battlechan.ts` was written for the current rules but has never run.
- Any real transaction, and the frontend against a live deployed program.
Known gaps: DAO vote weight uses balance at vote time (no snapshot); NFT mint stubbed; a few Miro comments (Dashboard, Post Reply screens) were never read.

## 5. Frontend notes (`app/`)
- Stack: Vite, React 18, TS, `@coral-xyz/anchor`, wallet-adapter (Phantom/Solflare), `@solana/spl-token`. Polls chain every 10 s via `src/store.tsx`; `src/lib/actions.ts` wraps program calls.
- Key files: `App.tsx` (shell, toolbar, views arena/archive/dashboard/dao/about), `components/Board.tsx` (grid, new-post form), `Thread.tsx`, `TimePopup.tsx` (clock pop-up), `Pots.tsx`, `Profile.tsx`, `Dao.tsx`, `Logo.tsx` (logo + SVG "Buy $TIME" star), `styles.css`.
- Assets in `app/public/`: `logo-mark.png` (1000px-source shamrock + swords crop, taken from the Miro board's logo image), `logo-mark-sm.png` (1x), `sword.png` (favicon, from the old ICP site). `coin.png` / `likes.png` are unused extras.
- **Demo mode**: `src/lib/demo.ts`. If the on-chain `config` account is not found, or the URL has `?demo`, the UI shows 12 sample posts, 3 categories and sample comments, with footer text "SAMPLE DATA (program not live yet)". Once the program is initialized the site switches to real data automatically. Remove or keep as a fallback — your call, but be honest in the submission about what is live.
- After deploying the program: update program id + cluster env, copy the fresh IDL into `app/src/idl/battlechan.json`, `npm run build`, redeploy.

## 6. How to deploy the site to Vercel
The Mac has the Vercel CLI via `npx vercel@latest` (logged in as `node0datasystems-3141`, signed in through the browser device flow).
```
cd solana/app && npm install && npm run build
echo '{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}' > dist/vercel.json
cd dist && npx vercel@latest deploy --prod --yes --name battlechan
```
(Claude deployed the built `dist/` folder directly; the project is not connected to Git.) Netlify is an acceptable fallback.

## 7. Vercel storage warning (resolved cause, pending recalculation)
Deployment Storage showed 10.22 GB / 10 GB on the Hobby plan, caused by the `agentasia` project (about 0.5 GB per deploy, 19 deployments). The owner deleted all but the two newest agentasia deployments. The meter had not dropped yet at handover; recheck. Recommended: set Deployment Retention on `agentasia` (Settings → Build & Deployment) and consider the same for `realcryptoindex` (17 deployments) and `realcryptoindex-backup-2026-06-17` (12). If a deploy of BattleChan ever fails with a storage error, this is why.

## 8. Merge checklist (combining Claude's work + the BrowserOS agent's work)
1. In the repo folder run `git status`, `git log --oneline -10`, and `git fetch origin` to see what the BrowserOS agent changed. Claude's last commit touched only `solana/app/`; the program/tests/scripts folders belong to the other agent — keep their versions when files conflict, keep Claude's `app/` UI unless the IDL changed.
2. Regenerate the IDL if the program changed and replace `app/src/idl/battlechan.json`; run `npx tsc --noEmit` in `app/` to catch interface drift (instruction/account names, args).
3. Never commit `target/deploy/*.json` (program keypair), wallet keypairs, or `.env`. `.gitignore` already excludes them; check `git ls-files | grep -i keypair` returns nothing.
4. Update `README.md` with the real program id, mint addresses and explorer links.
5. Push to `solana-port` (consider opening a PR to `main`).

## 9. Hackathon submission checklist
- [ ] Program deployed to Solana **testnet**; program id + explorer link.
- [ ] `scripts/init.ts` run: config, $TIME and $KARMA mints, vaults, seeded categories. Record mint addresses.
- [ ] `anchor test` results (passed/failed counts) noted in README.
- [ ] Live frontend URL reachable by judges (Vercel protection OFF) and pointing at the deployed program (not just sample data).
- [ ] 2–3 min demo video: connect wallet → faucet → create post → upvote (1 $TIME) → comment → like comment (free) → clock pop-up withdraw → archive → DAO.
- [ ] README: one-paragraph pitch, architecture (program accounts/PDAs), tokenomics table, how to run locally, honest "known limitations" list from section 4.
- [ ] Repo link public or shared with judges (it is currently private).

## 10. People/preferences
Casey prefers complete files over partial edits and dislikes the nano editor. Casey is based in Phnom Penh. Casey's other GitHub/Vercel projects (agentasia, realcryptoindex, etc.) are unrelated — do not modify them.
