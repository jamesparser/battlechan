import { useState } from "react";
import { isVideo } from "../lib/format";
import { useStore } from "../store";

export function Media({ url, blur }: { url: string; blur: boolean }) {
  const [revealed, setRevealed] = useState(false);
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return <div className="muted">media link: {url}</div>;
  const hide = blur && !revealed;
  const el = isVideo(url) ? (
    <video src={url} controls loop muted playsInline className="media" />
  ) : (
    <img src={url} className="media" loading="lazy" alt="" referrerPolicy="no-referrer" />
  );
  return (
    <div className={"mediawrap" + (hide ? " blurred" : "")} onClick={() => setRevealed(true)}>
      {el}
      {hide && <span className="reveal">Click to reveal</span>}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useStore();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.kind} onClick={() => dismiss(t.id)}>
          {t.text}{" "}
          {t.href && (
            <a href={t.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              view tx
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/** Shown when the wallet is connected but has no profile yet / no $TIME. */
export function Onboarding() {
  const { wallet, profile, balance, run, busy } = useStore();
  const [ref, setRef] = useState(() => new URLSearchParams(location.search).get("ref") || "");
  if (!wallet) {
    return (
      <div className="card hero">
        <h2>Posts battle for time. ⚔️</h2>
        <p>Connect a wallet (set it to <b>Solana testnet</b>), grab free test $TIME from the faucet, and start fighting for the front page.</p>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="card hero">
        <h2>Create your battle profile</h2>
        <p>One transaction. No email, no phone — just your wallet.</p>
        <div className="row">
          <input placeholder="Referrer wallet (optional)" value={ref} onChange={(e) => setRef(e.target.value.trim())} />
          <button className="primary" disabled={busy} onClick={() => run("Create profile", (a) => a.createProfile(ref || undefined))}>
            Join the arena
          </button>
        </div>
      </div>
    );
  }
  if (balance < 1) {
    return (
      <div className="card hero">
        <h2>You need $TIME to vote</h2>
        <p>Claim the free testnet airdrop (once a day). You also need a little testnet SOL for fees.</p>
        <div className="row">
          <button className="primary" disabled={busy} onClick={() => run("Claim faucet", (a) => a.faucet())}>
            Claim 100 $TIME
          </button>
          <a className="btn" href="https://faucet.solana.com" target="_blank" rel="noreferrer">Get testnet SOL</a>
        </div>
      </div>
    );
  }
  return null;
}

/** First-run: program deployed but `initialize` not called yet. */
export function AdminSetup() {
  return (
    <div className="card prose">
      <h2>Arena not initialized</h2>
      <p>The program is deployed but has not been initialized on this cluster yet. Run:</p>
      <pre>npm run init:testnet</pre>
      <p>That mints the fixed 100B $TIME supply, creates the vault/treasury and seeds starter categories.</p>
    </div>
  );
}
