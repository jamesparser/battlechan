import { useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useStore } from "../store";
import { FLAIRS, CATEGORY_HINTS } from "../lib/badges";
import { ago, fmtRemaining, fmtTime, shortKey, toNum } from "../lib/format";
import { Media } from "./Common";

export function Pots({ post, cfg }: { post: any; cfg: any }) {
  const bps = cfg?.opShareBps ?? 7500;
  const pot = toNum(post.pot);
  const opPot = Math.floor((pot * bps) / 10000);
  const cPot = pot - opPot;
  const opLeft = opPot - toNum(post.opWithdrawn);
  const cLeft = cPot - toNum(post.commenterPaid);
  return (
    <div className="pots">
      <div className="pot op"><span>Owner pot ({bps / 100}%)</span><b>{fmtTime(opLeft)}</b></div>
      <div className="pot cm"><span>Commenters ({100 - bps / 100}%)</span><b>{fmtTime(cLeft)}</b></div>
      <div className="pot dao"><span>→ DAO (downvotes)</span><b>{fmtTime(post.daoFromDown)}</b></div>
      <div className="pot burn"><span>🔥 Burned</span><b>{fmtTime(post.burnedFromDown)}</b></div>
    </div>
  );
}

export function PostCard({ post, blur, onOpen }: { post: any; blur: boolean; onOpen: (p: any) => void }) {
  const { now, cfg, run, busy, wallet, profile } = useStore();
  const [votes, setVotes] = useState(1);
  const rem = fmtRemaining(post.expiresAt.toNumber(), now);
  const cost = (toNum(cfg?.voteCost) / 1e6) * votes;
  const bombCost = cfg ? toNum(cfg.bombKarma) : 50_000_000;
  return (
    <article className={"post" + (post.archived ? " archived" : "") + (rem.expired ? " expired" : "")}>
      <div className="pmeta">
        <span className="id">#{post.id.toString()}</span>
        {post.flair > 0 && <span className="flair">{FLAIRS[post.flair]}</span>}
        <span className="muted">{shortKey(post.author)} · {ago(post.createdAt.toNumber(), now)}</span>
        <span className={"timer" + (rem.urgent ? " urgent" : "")} title="Time left before this post is bumped (stays visible until bumped)">
          ⏱ {post.archived ? "archived" : rem.text}
        </span>
      </div>
      <h3 onClick={() => onOpen(post)}>{post.title}</h3>
      {post.body && <p className="excerpt" onClick={() => onOpen(post)}>{post.body.slice(0, 220)}{post.body.length > 220 ? "…" : ""}</p>}
      {post.mediaUri && <Media url={post.mediaUri} blur={blur} />}
      <div className="stats">
        <span className="up">▲ {post.upVotes.toString()}</span>
        <span className="down">▼ {post.downVotes.toString()}</span>
        <span>💬 {post.commentCount}</span>
        <span className="time" tabIndex={0}>
          💰 {fmtTime(post.pot)} $TIME
          <div className="tip"><Pots post={post} cfg={cfg} /></div>
        </span>
        <button className="link" onClick={() => onOpen(post)}>open thread</button>
      </div>
      {wallet && profile && (
        <div className="actions">
          {!post.archived && (
            <>
              <input type="number" min={1} max={999} value={votes} onChange={(e) => setVotes(Math.max(1, Number(e.target.value) || 1))} className="vcount" />
              <button className="upv" disabled={busy} onClick={() => run(`Upvote ×${votes}`, (a) => a.vote(post, votes, true))} title={`Costs ${cost} $TIME, +${votes * 5} min`}>▲ +{votes * 5}m</button>
              <button className="dnv" disabled={busy} onClick={() => run(`Downvote ×${votes}`, (a) => a.vote(post, votes, false))} title={`Costs ${cost} $TIME (50% burned / 50% DAO), −${votes * 5} min`}>▼ −{votes * 5}m</button>
              <button className="bomb" disabled={busy || toNum(profile.karma) < bombCost} onClick={() => run("Karma bomb", (a) => a.bomb(post))} title={`Spend ${bombCost / 1e6} staked $KARMA: −10 min, no $TIME needed`}>💣</button>
            </>
          )}
          {post.archived && (
            <button className="dove" disabled={busy || toNum(profile.karma) < (cfg ? toNum(cfg.resurrectKarma) : 50_000_000)} onClick={() => run("Resurrect", (a) => a.resurrect(post))} title="Spend 50 staked $KARMA: +10 min and back into the arena">🕊️ Resurrect</button>
          )}
        </div>
      )}
    </article>
  );
}

function NewPost({ catId, onDone }: { catId: number; onDone: () => void }) {
  const { run, busy, profile } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState("");
  const [poll, setPoll] = useState<string[]>([]);
  if (!profile) return null;
  return (
    <form className="card newpost" onSubmit={async (e) => {
      e.preventDefault();
      const ok = await run("Create post", (a) => a.createPost(catId, title.trim(), body, media.trim(), poll.map((p) => p.trim()).filter(Boolean)));
      if (ok) { setTitle(""); setBody(""); setMedia(""); setPoll([]); onDone(); }
    }}>
      <input maxLength={80} placeholder="Title (free to post · starts with 30 min)" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea maxLength={1000} rows={4} placeholder="Say something worth fighting for…" value={body} onChange={(e) => setBody(e.target.value)} />
      <input maxLength={200} placeholder="Image / GIF / WebM URL (optional)" value={media} onChange={(e) => setMedia(e.target.value)} />
      {poll.length > 0 && (
        <div className="polledit">
          {poll.map((p, i) => (
            <input key={i} maxLength={40} placeholder={`Poll option ${i + 1}`} value={p} onChange={(e) => setPoll(poll.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          {poll.length < 4 && <button type="button" className="link" onClick={() => setPoll([...poll, ""])}>+ option</button>}
        </div>
      )}
      <div className="row">
        {poll.length === 0 && <button type="button" onClick={() => setPoll(["", ""])}>📊 Add poll</button>}
        <button className="primary" disabled={busy || !title.trim()}>Post to the arena</button>
      </div>
    </form>
  );
}

export function Board({ mode, catId, setCatId, onOpen, blur }: {
  mode: "live" | "archive"; catId: number; setCatId: (n: number) => void; onOpen: (p: any) => void; blur: boolean;
}) {
  const { cats, posts, run, busy, wallet, cfg } = useStore();
  const [composer, setComposer] = useState(false);
  const [sort, setSort] = useState<"rank" | "new">("rank");
  const [newCat, setNewCat] = useState("");
  const cat = cats.find((c) => c.id === catId) ?? cats[0];

  const list = useMemo(() => {
    if (!cat) return [];
    if (mode === "live") {
      const keys = new Set<string>(cat.slots.filter((k: PublicKey) => !k.equals(PublicKey.default)).map((k: PublicKey) => k.toBase58()));
      const live = posts.filter((p) => keys.has(p.key.toBase58()));
      // "rank" = most time left first (the post winning the battle is on top)
      return sort === "rank"
        ? live.sort((a, b) => b.expiresAt.toNumber() - a.expiresAt.toNumber())
        : live.sort((a, b) => b.createdAt.toNumber() - a.createdAt.toNumber());
    }
    return posts.filter((p) => p.category === cat.id && p.archived).sort((a, b) => b.id.toNumber() - a.id.toNumber());
  }, [cat, posts, mode, sort]);

  const isAdmin = wallet && cfg && cfg.admin.equals(wallet);

  return (
    <section>
      <div className="cats">
        {cats.map((c) => (
          <button key={c.id} className={c.id === cat?.id ? "on" : ""} onClick={() => setCatId(c.id)}>
            {c.name}
          </button>
        ))}
        {isAdmin && (
          <form className="inline" onSubmit={(e) => { e.preventDefault(); run("Create category", (a) => a.createCategory(newCat.trim())); setNewCat(""); }}>
            <input placeholder={`+ category (${CATEGORY_HINTS[cats.length % CATEGORY_HINTS.length]})`} value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={24} />
            <button disabled={busy || !newCat.trim()}>Add</button>
          </form>
        )}
      </div>
      {!cat ? (
        <div className="card center">No categories yet. {isAdmin ? "Add one above." : "The admin needs to seed them."}</div>
      ) : (
        <>
          <div className="boardhead">
            <h2>{cat.name} <small>{mode === "live" ? `${list.length}/20 in the arena` : `${list.length} archived`}</small></h2>
            <div className="row">
              {mode === "live" && (
                <select className="sort" value={sort} onChange={(e) => setSort(e.target.value as any)} title="Sort by">
                  <option value="rank">Sort: Rank</option>
                  <option value="new">Sort: Newest</option>
                </select>
              )}
              {mode === "live" && wallet && <button className="primary" onClick={() => setComposer(!composer)}>{composer ? "Close" : "＋ Create Post"}</button>}
            </div>
          </div>
          {composer && <NewPost catId={cat.id} onDone={() => setComposer(false)} />}
          <div className="grid">
            {list.map((p) => <PostCard key={p.key.toBase58()} post={p} blur={blur} onOpen={onOpen} />)}
            {list.length === 0 && <div className="card center">{mode === "live" ? "Empty arena. Be the first to post." : "Nothing archived yet."}</div>}
          </div>
        </>
      )}
    </section>
  );
}
