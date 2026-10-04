import { useStore } from "../store";
import { apyPct, computeBadges, DECORATIONS } from "../lib/badges";
import { useState } from "react";
import { fmtKarma, fmtTime, shortKey, toNum } from "../lib/format";
import { karmaToBase } from "../lib/actions";
import { explorerAddr, pda } from "../lib/chain";

export function ProfilePage() {
  const { profile, balance, karmaWallet, wallet, posts, run, busy, now, cfg } = useStore();
  const [amt, setAmt] = useState("");
  if (!wallet) return <div className="card center">Connect a wallet to see your profile.</div>;
  if (!profile) return <div className="card center">No profile yet — head to the Arena and join.</div>;

  const badges = computeBadges(profile, balance);
  const myPosts = posts.filter((p) => p.author.equals(wallet)).sort((a, b) => b.id.toNumber() - a.id.toNumber());
  const pending = myPosts.reduce((s, p) => s + Math.max(0, Math.floor((toNum(p.pot) * (cfg?.opShareBps ?? 7500)) / 10000) - toNum(p.opWithdrawn)), 0);
  const commentedToday = profile.lastCommentTs.toNumber() > 0 && now - profile.lastCommentTs.toNumber() <= 86400;
  const link = `${location.origin}${location.pathname}?ref=${wallet.toBase58()}`;
  const claimable =
    (toNum(profile.karma) / 1e6 * apyPct(profile)) / 100 *
    Math.min(30 * 86400, Math.max(0, now - profile.lastStakeClaimTs.toNumber())) / 31536000;

  return (
    <section className="profile">
      <div className="card">
        <h2>{shortKey(wallet)} {profile.decoration > 0 && <span className={"deco d" + profile.decoration}>{DECORATIONS[profile.decoration]}</span>}</h2>
        <div className="statgrid">
          <div><b>{fmtTime(balance * 1e6)}</b><span>$TIME balance</span></div>
          <div><b>{fmtKarma(profile.karma)}</b><span>$KARMA staked</span></div>
          <div><b>{karmaWallet.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b><span>$KARMA in wallet (liquid)</span></div>
          <div><b>{fmtTime(pending)}</b><span>pending on my live posts</span></div>
          <div><b>{profile.posts}</b><span>posts</span></div>
          <div><b>{profile.comments}</b><span>comments</span></div>
          <div><b>{apyPct(profile)}%</b><span>staking APY</span></div>
        </div>
        <div className="row wrap">
          <button className="primary" disabled={busy || !commentedToday || toNum(profile.karma) === 0} onClick={() => run("Claim staking rewards", (a) => a.claimStaking())}
            title="Requires a comment in the last 24h">
            Claim staking (~{claimable.toFixed(4)} $TIME)
          </button>
          {!commentedToday && <span className="muted">Comment once per day to earn staking rewards.</span>}
          <button disabled={busy} onClick={() => run("Faucet", (a) => a.faucet())}>Daily faucet</button>
        </div>
      </div>

      <div className="card">
        <h3>$KARMA staking</h3>
        <p className="muted">
          $KARMA is a real SPL token (mint <a href={explorerAddr(pda.karmaMint().toBase58())} target="_blank" rel="noreferrer">{shortKey(pda.karmaMint())}</a>).
          Earned karma is auto-staked. Unstake to move it to your wallet (tradeable, LP-able later); staked karma earns yield and powers 💣 bombs and 🕊️ resurrections.
        </p>
        <div className="row wrap">
          <input type="number" min={0} step="1" placeholder="amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
          <button disabled={busy || !amt || Number(amt) <= 0} onClick={() => run("Stake $KARMA", (a) => a.stakeKarma(karmaToBase(Number(amt))))}>Stake</button>
          <button disabled={busy || !amt || Number(amt) <= 0} onClick={() => run("Unstake $KARMA", (a) => a.unstakeKarma(karmaToBase(Number(amt))))}>Unstake</button>
        </div>
      </div>

      <div className="card">
        <h3>Badges</h3>
        <div className="badges">
          {badges.map((b) => <span key={b.id} className={"badge " + b.group} title={b.group}>{b.emoji} {b.label}</span>)}
        </div>
      </div>

      <div className="card">
        <h3>Decorations</h3>
        <p className="muted">Cosmetic profile flair, paid in $TIME to the DAO (id × 10).</p>
        <div className="row wrap">
          {DECORATIONS.map((d, i) => i > 0 && (
            <button key={i} disabled={busy || profile.decoration === i || balance < i * 10} onClick={() => run(`Decoration ${d}`, (a) => a.buyDecoration(i))}>{d} · {i * 10}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Referrals</h3>
        <p className="muted">Whenever someone you referred earns $KARMA, you earn 1 too.</p>
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      </div>

      <div className="card">
        <h3>My posts (permanent)</h3>
        {myPosts.map((p) => (
          <div key={p.key.toBase58()} className="line">
            <span>#{p.id.toString()} {p.title}</span>
            <span className="muted">▲{p.upVotes.toString()} ▼{p.downVotes.toString()} · {p.archived ? "archived" : "live"}</span>
          </div>
        ))}
        {myPosts.length === 0 && <p className="muted">Nothing yet.</p>}
      </div>
    </section>
  );
}
