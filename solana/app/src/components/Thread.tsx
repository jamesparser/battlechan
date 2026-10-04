import { useEffect, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useStore } from "../store";
import { pda } from "../lib/chain";
import { FLAIRS } from "../lib/badges";
import { ago, fmtRemaining, fmtTime, shortKey, toNum } from "../lib/format";
import { toBase } from "../lib/actions";
import { Media } from "./Common";
import { PostCard, Pots } from "./Board";

export function Thread({ post, blur, onBack }: { post: any; blur: boolean; onBack: () => void }) {
  const { actions, now, cfg, run, busy, wallet, profile, refresh } = useStore();
  const [comments, setComments] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState("");
  const [wd, setWd] = useState("");
  const rem = fmtRemaining(post.expiresAt.toNumber(), now);

  const load = async () => {
    if (!actions) return;
    const all = await actions.program.account.comment.all([
      { memcmp: { offset: 8, bytes: post.key.toBase58() } },
    ]);
    setComments(all.map((x: any) => ({ key: x.publicKey, ...x.account })).sort((a: any, b: any) => a.index - b.index));
  };
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [actions, post.key.toBase58()]);

  const isOwner = wallet && post.owner.equals(wallet);
  const bps = cfg?.opShareBps ?? 7500;
  const opAvail = Math.floor((toNum(post.pot) * bps) / 10000) - toNum(post.opWithdrawn);
  const initialDone = cfg ? now >= post.createdAt.toNumber() + toNum(cfg.initialSecs) : false;
  const threshold = cfg?.commentThreshold ?? 5;

  const shareUrl = `${location.origin}${location.pathname}?post=${post.id.toString()}`;
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`"${post.title}" is fighting for time on BattleChan ⚔️`)}&url=${encodeURIComponent(shareUrl)}`;

  const pollTotal = post.pollVotes.slice(0, post.pollOptions.length).reduce((a: number, b: number) => a + b, 0);

  return (
    <section className="thread">
      <button className="link" onClick={onBack}>← back</button>
      <PostCard post={post} blur={blur} onOpen={() => {}} />
      <div className="card">
        <p className="body">{post.body}</p>
        <div className="row wrap">
          <a className="btn" href={tweet} target="_blank" rel="noreferrer">Share on X</a>
          <span className="muted">Owner {shortKey(post.owner)} · {post.archived ? "archived" : rem.text}</span>
        </div>
        <Pots post={post} cfg={cfg} />
      </div>

      {post.pollOptions.length > 0 && (
        <div className="card">
          <h3>📊 Poll</h3>
          {post.pollOptions.map((o: string, i: number) => {
            const v = post.pollVotes[i];
            const pct = pollTotal ? Math.round((v / pollTotal) * 100) : 0;
            return (
              <button key={i} className="pollopt" disabled={busy || !profile} onClick={() => run("Poll vote", (a) => a.pollVote(post, i))} style={{ ["--pct" as any]: pct + "%" }}>
                <span>{o}</span><b>{v} · {pct}%</b>
              </button>
            );
          })}
        </div>
      )}

      {isOwner && (
        <div className="card owner">
          <h3>Owner tools</h3>
          <p className="muted">
            Withdrawable now: <b>{fmtTime(opAvail)}</b> $TIME. {initialDone ? "Withdrawing shaves time off the clock (60s per $TIME withdrawn)." : "Unlocks after the first 30 minutes."}
          </p>
          <div className="row wrap">
            <input type="number" min={0} step="0.1" placeholder="amount (blank = all)" value={wd} onChange={(e) => setWd(e.target.value)} />
            <button className="primary" disabled={busy || !initialDone || opAvail <= 0}
              onClick={() => run("Withdraw $TIME", (a) => a.opWithdraw(post, wd ? toBase(Number(wd)) : new BN(opAvail)))}>
              Withdraw
            </button>
            <select defaultValue="" onChange={(e) => { const f = Number(e.target.value); if (f) run(`Buy flair (${f * 10} $TIME)`, (a) => a.buyFlair(post, f)); e.target.value = ""; }}>
              <option value="">Buy flair…</option>
              {FLAIRS.map((f, i) => i > 0 && <option key={i} value={i}>{f} — {i * 10} $TIME</option>)}
            </select>
          </div>
        </div>
      )}

      {wallet && profile && !post.archived && (
        <form className="card" onSubmit={async (e) => {
          e.preventDefault();
          if (await run("Comment", (a) => a.createComment(post, body.trim(), media.trim()))) { setBody(""); setMedia(""); load(); refresh(); }
        }}>
          <textarea rows={3} maxLength={500} placeholder="Add a comment (5 likes = $KARMA + a share of the commenter pot)" value={body} onChange={(e) => setBody(e.target.value)} />
          <input maxLength={200} placeholder="GIF / WebM / image URL (optional)" value={media} onChange={(e) => setMedia(e.target.value)} />
          <button className="primary" disabled={busy || (!body.trim() && !media.trim())}>Comment</button>
        </form>
      )}

      <div className="comments">
        <h3>{comments.length} comments</h3>
        {comments.map((c) => {
          const mine = wallet && c.author.equals(wallet);
          const eligible = c.likes >= threshold;
          return (
            <div key={c.key.toBase58()} className="comment">
              <div className="muted">{shortKey(c.author)} · {ago(c.createdAt.toNumber(), now)} {c.author.equals(post.author) && <span className="op">OP</span>}</div>
              <p>{c.body}</p>
              {c.mediaUri && <Media url={c.mediaUri} blur={blur} />}
              <div className="row">
                <button disabled={busy || !profile || mine} onClick={() => run("Like", (a) => a.voteComment(post, c, true)).then(load)}>👍 {c.likes}</button>
                <button disabled={busy || !profile || mine} onClick={() => run("Dislike", (a) => a.voteComment(post, c, false)).then(load)}>👎 {c.dislikes}</button>
                {eligible && <span className="chip">reward-eligible</span>}
                {mine && eligible && (
                  <button className="primary" disabled={busy} onClick={() => run("Claim comment reward", (a) => a.claimCommentReward(post, c)).then(load)}>Claim $TIME</button>
                )}
                {c.rewardClaimed.toNumber() > 0 && <span className="muted">claimed {fmtTime(c.rewardClaimed)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
