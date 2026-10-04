import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { StoreProvider, useStore } from "./store";
import { seasonalTheme } from "./lib/badges";
import { explorerAddr, PROGRAM_ID, CLUSTER } from "./lib/chain";
import { fmtKarma, fmtTime } from "./lib/format";
import { Board } from "./components/Board";
import { Thread } from "./components/Thread";
import { ProfilePage } from "./components/Profile";
import { DaoPage } from "./components/Dao";
import { Onboarding, AdminSetup, Toasts } from "./components/Common";

type Tab = "board" | "archive" | "profile" | "dao" | "about";

function Shell() {
  const s = useStore();
  const theme = seasonalTheme();
  const [tab, setTab] = useState<Tab>("board");
  const [catId, setCatId] = useState<number>(0);
  const [openPost, setOpenPost] = useState<any>(null);
  const [night, setNight] = useState<boolean>(() => {
    try { return localStorage.getItem("bc_night") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
    try { localStorage.setItem("bc_night", night ? "1" : "0"); } catch {}
  }, [night]);
  const [blur, setBlur] = useState<boolean>(() => {
    try { return localStorage.getItem("bc_blur") === "1"; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty("--accent2", theme.accent2);
  }, [theme.accent, theme.accent2]);
  useEffect(() => { try { localStorage.setItem("bc_blur", blur ? "1" : "0"); } catch {} }, [blur]);

  // keep open thread fresh
  useEffect(() => {
    if (openPost) {
      const fresh = s.posts.find((p) => p.key.equals(openPost.key));
      if (fresh && fresh !== openPost) setOpenPost(fresh);
    }
  }, [s.posts]);

  const swap = import.meta.env.VITE_SWAP_URL as string;
  const nft = import.meta.env.VITE_NFT_URL as string;
  const tw = import.meta.env.VITE_TWITTER as string;
  const tg = import.meta.env.VITE_TELEGRAM as string;

  return (
    <div className="app">
      <header className="top">
        <div className="brand" onClick={() => { setTab("board"); setOpenPost(null); }}>
          <span className="logo">{theme.glyph}</span>
          <div>
            <h1>BattleChan</h1>
            <small>{theme.name} · Solana {CLUSTER}</small>
          </div>
        </div>
        <nav className="tabs">
          {(["board", "archive", "profile", "dao", "about"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); setOpenPost(null); }}>
              {t === "board" ? "Arena" : t === "dao" ? "DAO" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <div className="wallet">
          {s.wallet && (
            <div className="bal" title="Your $TIME balance">
              <b>{fmtTime(s.balance * 1e6)}</b> $TIME
              {s.profile && <> · <b>{fmtKarma(s.profile.karma)}</b> $KARMA</>}
            </div>
          )}
          <WalletMultiButton />
        </div>
      </header>

      <div className="links">
        <label className="chk" title="Blurs external images/videos until clicked. Placeholder for the planned AI adult-content filter.">
          <input type="checkbox" checked={blur} onChange={(e) => setBlur(e.target.checked)} /> Blur media
        </label>
        <button className="link" onClick={() => setNight(!night)} title="Toggle day / night mode">{night ? "☀️ Day" : "🌙 Night"}</button>
        <a className="star" href={swap} target="_blank" rel="noreferrer" title="Buy $TIME">⭐ Buy $TIME</a>
        <a href={nft} target="_blank" rel="noreferrer">NFT market</a>
        <a href={tw} target="_blank" rel="noreferrer">X</a>
        <a href={tg} target="_blank" rel="noreferrer">Telegram</a>
      </div>

      <main>
        {!s.initialized ? (
          <AdminSetup />
        ) : s.loading ? (
          <div className="card center">Loading the arena…</div>
        ) : openPost ? (
          <Thread post={openPost} blur={blur} onBack={() => setOpenPost(null)} />
        ) : tab === "board" ? (
          <>
            <Onboarding />
            <Board mode="live" catId={catId} setCatId={setCatId} onOpen={setOpenPost} blur={blur} />
          </>
        ) : tab === "archive" ? (
          <Board mode="archive" catId={catId} setCatId={setCatId} onOpen={setOpenPost} blur={blur} />
        ) : tab === "profile" ? (
          <ProfilePage />
        ) : tab === "dao" ? (
          <DaoPage />
        ) : (
          <About />
        )}
      </main>
      <footer>
        Program{" "}
        <a href={explorerAddr(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">
          {PROGRAM_ID.toBase58().slice(0, 8)}…
        </a>{" "}
        · testnet demo · tokens have no real value
      </footer>
      <Toasts />
    </div>
  );
}

function About() {
  const { cfg } = useStore();
  return (
    <div className="card prose">
      <h2>How BattleChan works</h2>
      <p>Every post starts with <b>30 minutes</b> on the clock. Each <b>upvote adds 5 minutes</b>, each <b>downvote removes 5</b>. Only <b>20 posts</b> live in a category — newer posts bump the oldest into the permanent archive. Expired posts stay visible until they get bumped.</p>
      <p><b>$TIME</b> upvotes fill the post's pot: <b>75%</b> to the owner, <b>25%</b> to commenters with 5+ likes (pro-rata). <b>Downvotes:</b> 50% burned, 50% to the DAO treasury. Voting is unlimited as long as you hold $TIME.</p>
      <p><b>$KARMA</b>: 1 for every 5 likes on your comment (referrer earns 1 too). It is auto-staked; comment daily to earn staking yield (3% base, up to 10% with milestones). Spend 50 $KARMA on a <b>💣 bomb</b> (-10 min) or a <b>🕊️ resurrection</b> (+10 min, from the archive).</p>
      {cfg && (
        <ul className="params">
          <li>Vote cost: {fmtTime(cfg.voteCost)} $TIME</li>
          <li>Initial time: {cfg.initialSecs.toString()}s · per vote: {cfg.voteSecs.toString()}s</li>
          <li>Owner share: {cfg.opShareBps / 100}% · quorum: {fmtTime(cfg.quorum, 0)} $TIME</li>
          <li>Total burned: {fmtTime(cfg.totalBurned)} · to DAO: {fmtTime(cfg.totalToDao)}</li>
        </ul>
      )}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
