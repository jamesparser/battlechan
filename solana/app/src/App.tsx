import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { StoreProvider, useStore } from "./store";
import { seasonalTheme } from "./lib/badges";
import { explorerAddr, PROGRAM_ID, CLUSTER } from "./lib/chain";
import { fmtKarma, fmtTime } from "./lib/format";
import { Arena } from "./components/Board";
import { Thread } from "./components/Thread";
import { ProfilePage } from "./components/Profile";
import { DaoPage } from "./components/Dao";
import { Logo } from "./components/Logo";
import { demo } from "./lib/demo";
import { Onboarding, AdminSetup, Toasts } from "./components/Common";

type View = "arena" | "archive" | "dashboard" | "dao" | "about";

function Shell() {
  const s = useStore();
  const theme = seasonalTheme();
  const [view, setView] = useState<View>("arena");
  const [catId, setCatId] = useState(0);
  const [openPost, setOpenPost] = useState<any>(null);
  const [composer, setComposer] = useState(false);
  const [sort, setSort] = useState<"rank" | "new">("rank");
  const [page, setPage] = useState(1);
  const [night, setNight] = useState<boolean>(() => {
    try { return localStorage.getItem("bc_night") === "1"; } catch { return false; }
  });
  const [blur, setBlur] = useState<boolean>(() => {
    try { return localStorage.getItem("bc_blur") === "1"; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
    try { localStorage.setItem("bc_night", night ? "1" : "0"); } catch {}
  }, [night]);
  useEffect(() => { try { localStorage.setItem("bc_blur", blur ? "1" : "0"); } catch {} }, [blur]);
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme.accent);
  }, [theme.accent]);

  // deep link ?post=ID
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("post");
    if (id && s.posts.length && !openPost) {
      const p = s.posts.find((x) => x.id.toString() === id);
      if (p) setOpenPost(p);
    }
  }, [s.posts]);
  useEffect(() => {
    if (openPost) {
      const fresh = s.posts.find((p) => p.key.equals(openPost.key));
      if (fresh && fresh !== openPost) setOpenPost(fresh);
    }
  }, [s.posts]);

  const go = (v: View) => { setView(v); setOpenPost(null); };
  const swap = import.meta.env.VITE_SWAP_URL as string;
  const nft = import.meta.env.VITE_NFT_URL as string;
  const tw = import.meta.env.VITE_TWITTER as string;
  const tg = import.meta.env.VITE_TELEGRAM as string;
  const inArena = (view === "arena" || view === "archive") && !openPost;

  return (
    <div className="app">
      <div className="topline">
        <span className="net">{theme.glyph} {theme.name} · Solana {CLUSTER}</span>
        <span className="links">
          <label className="chk" title="Blur external media until clicked (placeholder for the planned AI adult-content filter)"><input type="checkbox" checked={blur} onChange={(e) => setBlur(e.target.checked)} /> Blur media</label>
          <a href={nft} target="_blank" rel="noreferrer">NFT market</a>
          <a href={tw} target="_blank" rel="noreferrer">X</a>
          <a href={tg} target="_blank" rel="noreferrer">Telegram</a>
        </span>
        <span className="wallet">
          {s.wallet && (
            <span className="bal">
              <b>{fmtTime(s.balance * 1e6)}</b> $TIME{s.profile && <> · <b>{fmtKarma(s.profile.karma)}</b> $KARMA</>}
            </span>
          )}
          <WalletMultiButton />
        </span>
      </div>

      <header className="frame head">
        <a className="star" href={swap} target="_blank" rel="noreferrer" title="Buy $TIME"><span>Buy<br />$TIME</span></a>
        <div className="logoblock" onClick={() => go("arena")}>
          <Logo size={84} />
        </div>
        <button className="greenbtn createbtn" onClick={() => { go("arena"); setComposer((c) => !c); }}>Create Post</button>
      </header>

      <nav className="bar">
        <span className="barleft">
          {[1, 2, 3, 4].slice(0, 2).map((n) => (
            <button key={n} className={"pg" + (page === n && inArena ? " on" : "")} onClick={() => { go(view === "archive" ? "archive" : "arena"); setPage(n); }}>Pg {n}</button>
          ))}
          <button className="pg" onClick={() => s.refresh()}>Refresh</button>
          <button className="pg ico" title="Day mode" onClick={() => setNight(false)}>☀️</button>
          <button className="pg ico" title="Night mode" onClick={() => setNight(true)}>🌑</button>
          <button className={"pg" + (view === "archive" ? " on" : "")} onClick={() => go(view === "archive" ? "arena" : "archive")}>Archive</button>
          <button className={"pg" + (view === "dao" ? " on" : "")} onClick={() => go("dao")}>DAO</button>
          <button className={"pg" + (view === "about" ? " on" : "")} onClick={() => go("about")}>?</button>
        </span>
        <span className="barright">
          Sort By:{" "}
          <select value={sort} onChange={(e) => { setSort(e.target.value as any); setPage(1); }}>
            <option value="rank">Rank</option>
            <option value="new">New</option>
          </select>{" "}
          <button className={"pg" + (view === "dashboard" ? " on" : "")} onClick={() => go("dashboard")}>Dashboard</button>
        </span>
      </nav>

      <main>
        {!s.initialized ? (
          <AdminSetup />
        ) : s.loading ? (
          <div className="frame center">Loading the arena…</div>
        ) : openPost ? (
          <Thread post={openPost} blur={blur} onBack={() => setOpenPost(null)} />
        ) : view === "arena" || view === "archive" ? (
          <>
            <Onboarding />
            <Arena mode={view === "arena" ? "live" : "archive"} catId={catId} setCatId={setCatId} onOpen={setOpenPost} blur={blur}
              composer={composer} setComposer={setComposer} sort={sort} page={page} setPage={setPage} />
          </>
        ) : view === "dashboard" ? (
          <ProfilePage />
        ) : view === "dao" ? (
          <DaoPage />
        ) : (
          <About />
        )}
      </main>
      <footer>
        Program <a href={explorerAddr(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">{PROGRAM_ID.toBase58().slice(0, 8)}…</a> · testnet demo · tokens have no real value{demo.on && " · SAMPLE DATA (program not live yet)"}
      </footer>
      <Toasts />
    </div>
  );
}

function About() {
  const { cfg } = useStore();
  return (
    <div className="frame prose">
      <h2>How BattleChan works</h2>
      <p>Every post starts with <b>5 free minutes</b>. 👍 costs <b>1 $TIME</b> and adds <b>1 minute</b>; 💩 costs <b>1 $TIME</b> and removes <b>1 minute</b>. Liking or disliking <i>comments</i> is free. Page 1 shows the top 25 posts of a category (sorted by Rank or New); the rest flow to page 2, and the oldest live post is bumped into the permanent archive when a new one arrives. Expired posts stay visible until bumped.</p>
      <p>Click a post's clock for the pop-up: the creator can <b>withdraw</b> up to 75% of the pot to their wallet (each token withdrawn also removes a minute); 25% is shared by commenters with 5+ likes. Downvote $TIME is 50% burned and 50% sent to the DAO treasury.</p>
      <p><b>$KARMA</b> is a real token: 1 per 5 comment likes, auto-staked (3–10% APY in $TIME if you comment daily). Spend 50 on 💣 (−10 min) or 🕊️ (+10 min, from the archive). Header icons: 👍 like, 💩 dislike, 💸 tip, 🐥 tweet, 🔞 report to admin.</p>
      {cfg && (
        <ul className="params">
          <li>Vote cost: {fmtTime(cfg.voteCost)} $TIME · per vote: {cfg.voteSecs.toString()}s · initial: {cfg.initialSecs.toString()}s</li>
          <li>Creator share: {cfg.opShareBps / 100}% · quorum: {fmtTime(cfg.quorum, 0)} $TIME</li>
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
