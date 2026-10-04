import { useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStore } from "../store";
import { PAGE_SIZE } from "../lib/chain";
import { fmtTime, toNum } from "../lib/format";
import { Media } from "./Common";
import { Pots } from "./Pots";
import { TimePopup } from "./TimePopup";

export function clock(expiresAt: number, now: number) {
  const left = expiresAt - now;
  if (left <= 0) return { text: "00:00", expired: true, urgent: true };
  const m = Math.floor(left / 60);
  const s = left % 60;
  const text = m >= 100 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return { text, expired: false, urgent: left < 60 };
}

export const pad4 = (n: number | string) => String(n).padStart(4, "0");

export function Tile({ post, blur, onOpen, onTime }: { post: any; blur: boolean; onOpen: (p: any) => void; onTime: (p: any) => void }) {
  const { now, run, busy, wallet, profile } = useStore();
  const c = clock(post.expiresAt.toNumber(), now);
  const can = !!wallet && !!profile && !busy;
  return (
    <article className={"tile" + (post.archived ? " archived" : "") + (c.expired && !post.archived ? " expired" : "")}>
      <button className="thumb" onClick={() => onOpen(post)} title={post.title}>
        {post.mediaUri ? <Media url={post.mediaUri} blur={blur} bare /> : <span className="glyph">{post.title.slice(0, 1).toUpperCase()}</span>}
        {post.pollOptions.length > 0 && <span className="pill">📊</span>}
        {post.archived && <span className="pill dove">🕊️</span>}
      </button>
      <h3 className="ptext" onClick={() => onOpen(post)}>{post.title}</h3>
      <div className="vrow">
        <button className="emo" disabled={!can || post.archived} onClick={() => run("Upvote (1 $TIME = +1 min)", (a) => a.vote(post, 1, true))} title="Upvote: costs 1 $TIME, adds 1 minute">👍</button>
        <span className="cnt" title="upvotes">{post.upVotes.toString()}</span>
        <button className={"time" + (c.urgent ? " urgent" : "")} onClick={() => onTime(post)} title="Click for the time pop-up">
          {post.archived ? "ARCH" : c.text}
        </button>
        <span className="cnt" title="downvotes">{post.downVotes.toString()}</span>
        <button className="emo" disabled={!can || post.archived} onClick={() => run("Downvote (1 $TIME = −1 min)", (a) => a.vote(post, 1, false))} title="Downvote: costs 1 $TIME, removes 1 minute">💩</button>
      </div>
      <div className="mini">
        <span>💬 {post.commentCount}</span>
        <span className="time-hover" tabIndex={0}>💰 {fmtTime(post.pot)}<div className="tip"><PotsHover post={post} /></div></span>
      </div>
    </article>
  );
}

function PotsHover({ post }: { post: any }) {
  const { cfg } = useStore();
  return <Pots post={post} cfg={cfg} />;
}

export function NewPost({ catId, onDone }: { catId: number; onDone: () => void }) {
  const { run, busy, profile } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState("");
  const [poll, setPoll] = useState<string[]>([]);
  if (!profile) return <div className="frame form"><p className="muted">Join the arena first (button above).</p></div>;
  return (
    <form className="frame form" onSubmit={async (e) => {
      e.preventDefault();
      const ok = await run("Create post", (a) => a.createPost(catId, title.trim(), body, media.trim(), poll.map((p) => p.trim()).filter(Boolean)));
      if (ok) { setTitle(""); setBody(""); setMedia(""); setPoll([]); onDone(); }
    }}>
      <div className="frow"><label>Name</label><input value="Anonymous" readOnly /><button className="greenbtn" disabled={busy || !title.trim()}>Post</button></div>
      <div className="frow"><label>Subject</label><input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
      <div className="frow top"><label>Body</label><textarea rows={4} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="frow"><label className="g">Image</label><input maxLength={200} placeholder="image / GIF / WebM link" value={media} onChange={(e) => setMedia(e.target.value)} />
        <button type="button" className="yellowbtn" disabled title="Minting a post as an NFT is on the roadmap. For now posts can be traded owner-to-owner from the time pop-up.">Mint NFT</button></div>
      {poll.length > 0 && (
        <div className="frow top"><label>Poll</label><div className="pollbox">
          {poll.map((p, i) => <input key={i} maxLength={40} placeholder={`Option ${i + 1}`} value={p} onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))} />)}
          {poll.length < 4 && <button type="button" className="link" onClick={() => setPoll([...poll, ""])}>+ option</button>}
        </div></div>
      )}
      {poll.length === 0 && <button type="button" className="link" onClick={() => setPoll(["", ""])}>＋ add poll</button>}
      <p className="muted">New posts start with 5 free minutes. Each 👍 (1 $TIME) adds a minute, each 💩 (1 $TIME) removes one.</p>
    </form>
  );
}

export function Arena({ mode, catId, setCatId, onOpen, blur, composer, setComposer, sort, page, setPage }: {
  mode: "live" | "archive"; catId: number; setCatId: (n: number) => void; onOpen: (p: any) => void; blur: boolean;
  composer: boolean; setComposer: (b: boolean) => void; sort: "rank" | "new"; page: number; setPage: (n: number) => void;
}) {
  const { cats, posts, run, busy, wallet, cfg } = useStore();
  const [newCat, setNewCat] = useState("");
  const [popup, setPopup] = useState<any>(null);
  const cat = cats.find((c) => c.id === catId) ?? cats[0];

  const list = useMemo(() => {
    if (!cat) return [];
    if (mode === "live") {
      const keys = new Set<string>(cat.slots.filter((k: PublicKey) => !k.equals(PublicKey.default)).map((k: PublicKey) => k.toBase58()));
      const live = posts.filter((p) => keys.has(p.key.toBase58()));
      return sort === "rank"
        ? live.sort((a, b) => b.expiresAt.toNumber() - a.expiresAt.toNumber())
        : live.sort((a, b) => b.createdAt.toNumber() - a.createdAt.toNumber());
    }
    return posts.filter((p) => p.category === cat.id && p.archived).sort((a, b) => b.id.toNumber() - a.id.toNumber());
  }, [cat, posts, mode, sort]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const slice = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const isAdmin = wallet && cfg && cfg.admin.equals(wallet);
  const livePopup = popup ? posts.find((p) => p.key.equals(popup.key)) : null;

  return (
    <section>
      <div className="catrow">
        {cats.map((c) => (
          <button key={c.id} className={"chip" + (c.id === cat?.id ? " on" : "")} onClick={() => { setCatId(c.id); setPage(1); }}>{c.name}</button>
        ))}
        {isAdmin && (
          <form className="inline" onSubmit={(e) => { e.preventDefault(); run("Create category", (a) => a.createCategory(newCat.trim())); setNewCat(""); }}>
            <input placeholder="+ category" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={24} />
            <button disabled={busy || !newCat.trim()}>Add</button>
          </form>
        )}
      </div>
      {composer && cat && mode === "live" && <NewPost catId={cat.id} onDone={() => setComposer(false)} />}
      <div className="frame listframe">
        {!cat ? (
          <p className="center muted">No categories yet. {isAdmin ? "Add one above." : "The admin needs to seed them."}</p>
        ) : slice.length === 0 ? (
          <p className="center muted">{mode === "live" ? "Empty arena. Be the first to post." : "Nothing archived yet."}</p>
        ) : (
          <div className="grid4">{slice.map((p) => <Tile key={p.key.toBase58()} post={p} blur={blur} onOpen={onOpen} onTime={setPopup} />)}</div>
        )}
      </div>
      {pages > 1 && (
        <div className="pager">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button key={n} className={n === cur ? "on" : ""} onClick={() => setPage(n)}>Pg {n}</button>
        ))}</div>
      )}
      {livePopup && <TimePopup post={livePopup} onClose={() => setPopup(null)} />}
    </section>
  );
}

export { toNum };
