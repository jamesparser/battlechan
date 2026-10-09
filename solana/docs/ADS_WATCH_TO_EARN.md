# Battlechan — Ads & Watch-to-Earn Spec (not implemented)

Status: **design only** — do not ship code from this doc without a separate implementation pass.  
Source: Janosch (Oct 2026) — lower the entry hurdle; watch clips to earn $TIME.

---

## 1. Goals

1. Let new users earn **$TIME** without buying tokens (faucet alternative / supplement).
2. Monetize traffic with **display + rewarded video** without wrecking UX.
3. Keep farming risk low (caps, login, CAPTCHA).

---

## 2. Surface map

| Surface | Format | Placement | Notes |
|---|---|---|---|
| **Top banner** | 728×90 / 970×90 | Under site header, above board | Sticky optional; avoid covering Create Post |
| **Bottom banner** | 728×90 / mobile 320×50 | Above footer / program id line | |
| **Watch video (rewarded)** | Modal popup | Button: **“Watch ad → earn $TIME”** near faucet / header | 30–60s clip; close only after completion |

Do **not** put interstitials inside threads (breaks imageboard flow).

---

## 3. Watch-to-earn loop

```
User clicks "Watch ad"
  → CAPTCHA (if session untrusted)
  → Modal: rewarded video (30–60s)
  → Must complete + stay in tab
  → On success: credit $TIME to on-chain profile / faucet claim
  → Daily cap enforced
```

### Rules (v1)

| Rule | Value |
|---|---|
| Reward per completed video | **1 $TIME** (see §5 — may raise) |
| Daily cap | **5 videos / logged-in user / UTC day** |
| Auth | Wallet connected + profile PDA exists |
| Anti-bot | CAPTCHA (Turnstile / hCaptcha) on first claim of the day; rate-limit by IP + wallet |
| Incomplete / muted / backgrounded | **No credit** (provider completion callback only) |
| Self-click / VPN farms | Block known datacenter IPs; one wallet = one quota |

---

## 4. Recommended ad stack

### Rewarded video (popup)

| Provider | Why | Notes |
|---|---|---|
| **Primary: offerwall / rewarded SDK** (Tapjoy, Playtime, Unity Ads rewarded, or **A-ADS video** if only web) | “Watch → reward” is their core product | Need completion webhook / client event |
| **Crypto niche fallback: A-ADS** | Simple, crypto-friendly, no strict KYC | Lower fill in some geos |

**Recommendation:** **A-ADS for launch** (fast, crypto-native), then add **Tapjoy/Playtime offerwall** if we need higher fill and can do mobile or a web wrapper.

### Display banners (top + bottom)

| Provider | Why |
|---|---|
| **Primary: Coinzilla** (or Bitmedia / CoinTraffic) | Crypto advertisers, Solana-friendly |
| **Secondary: A-ADS** | Easy fill, same account as video |

Avoid AdSense/AdMob for a crypto SocialFi app (policy friction + content moderation risk).

### Direct (later)

Sponsored post slot: partner pays fixed fee for a pinned / boosted battle (cleaner CPM than banners).

---

## 5. Economics (1 $TIME per video?)

**Short answer:** 1 $TIME/video is **safe but weak** as an entry tool.

Reality check on rewarded video (30s, web3-adjacent traffic):

| Metric | Typical |
|---|---|
| CPM (gross) | $10–40 (US/EU) |
| Revenue / completed view | **$0.01–0.04** |
| After provider fee (~30–50%) | **~$0.005–0.02 to platform** |

If we pay **1 $TIME** per view, the token must not be worth more than a few cents *or* we treat $TIME as game credit until mainnet liquidity.

| Option | Reward / video | 5 videos/day | Matches current faucet? |
|---|---|---|---|
| A (user suggestion) | 1 $TIME | 5 $TIME | **No** — faucet is 100/day; too small |
| B (balanced) | **20 $TIME** | 100 $TIME | Yes — same as daily faucet |
| C (premium) | 50 $TIME | 250 $TIME | Faucet + ads both generous; watch inflation |

**Recommendation:** start at **1 $TIME/video** only if we also **lower the faucet** (e.g. 25/day) so ads feel useful. Otherwise ship **20 $TIME × 5 = 100/day** as a drop-in “earn the faucet by watching.”

USD side: even 5×$/view is only **~$0.05–0.10 user value/day** — fine for entry, not a job. Track **eCPM per geo** and adjust.

---

## 6. Implementation notes (when someone builds it)

- **Never mint unbounded $TIME for ads** without a treasury policy. Prefer: ad revenue in USDC/SOL → fund a **faucet vault**; claims draw from vault. If minting, hard daily global cap.
- Web: top/bottom `iframe` or provider JS; popup is `dialog` + provider player.
- Mobile later: offerwall SDK + deep link back to claim.
- Log: `user_id`, `wallet`, `provider`, `completed_at`, `reward`, `geo` for fraud review.
- Compliance: no tobacco/gambling/NSFW if avoidable; label **Ads** clearly; don’t trick clicks.

---

## 7. Open questions

1. Final $TIME per video (1 vs 20) after mainnet pricing?
2. CAPTCHA every claim vs once per day?
3. Do banners show to logged-out visitors? (Yes, recommended — monetize lurkers.)
4. Solana Foundation / ecosystem sponsor deals instead of generic networks?

---

*Related: faucet instruction, profile claims, daily caps in on-chain `config`.*
