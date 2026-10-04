import { useEffect, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useStore } from "../store";
import { demo, demoComments } from "../lib/demo";
import { FLAIRS } from "../lib/badges";
import { shortKey, toNum } from "../lib/format";
import { toBase } from "../lib/actions";
import { Media } from "./Common";
import { clock, pad4 } from "./Board";
import { TimePopup } from "./TimePopup";

const stamp = (ts: number) => {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const num = (n: number | string, w = 13) => "#" + String(n).padStart(w, "0");

/** Body text: lines starting with ">" are green-text quotes (imageboard style). */
function Body({ text }: { text: string }) {
  return (
    <div className="bodytext">
      {text.split("\n").map((l, i) => (l.startsWith(">") ? <div key={i} className="quote">{l}</div> : <div key={i}>{l || " "}</div>))}
    </div>
  );
}

export function Thread({ post, blur, onBack }: { post: any; blur: boolean; onBack: () => void }) {
  const { actions, now, cfg, run, busy, wallet, profile, refresh } = useStore();
  const [comments, setComments] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState("");
  const [popup, setPopup] = useState(false);

  const load = async () => {
    if (demo.on) { setComments(demoComments(post)); return; }
    if (!actions) return;
    const all = await actions.program.account.comment.all([{ memcmp: { offset: 8, bytes: post.key.toBase58() } }]);
    setComments(all.map((x: any) => ({ key: x.publicKey, ...x.account })).sort((a: any, b: any) => a.index - b.index));
  };
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [actions, post.key.toBase58()]);

  const threshold = cfg?.commentThreshold ?? 5;
  const shareUrl = `${location.origin}${location.pathname}?post=${post.id.toString()}`;
  const tweet = (text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
  const c = clock(post.expiresAt.toNumber(), now);
  const can = !!wallet && !!profile && !busy;
  const pollTotal = post.pollVotes.slice(0, post.pollOptions.length).reduce((a: number, b: number) => a + b, 0);

  const tip = async (to: any, label: string) => {
    const v = prompt(`Tip ${shortKey(to)} how many $TIME?`, "1");
    if (!v || Number(v) <= 0) return;
    await run(`Tip ${v} $TIME to ${label}`, (a) => a.tip({ owner: to }, toBase(Number(v))));
  };

  return (
    <section className="thread">
      <button className="link back" onClick={onBack}>← back to arena</button>

      {wallet && profile && !post.archived && (
        <form className="frame form" onSubmit={async (e) => {
          e.preventDefault();
          if (await run("Post reply", (a) => a.createComment(post, body.trim(), media.trim()))) { setBody(""); setMedia(""); load(); refresh(); }
        }}>
          <div className="frow"><label>Name</label><input value="Anonymous" readOnly /></div>
          <div className="frow top"><label>Body</label><textarea rows={3} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply… (start a line with > to quote, e.g. >#0000000000001)" /></div>
          <div className="frow"><label className="g">Image</label><input maxLength={200} placeholder="image / GIF / WebM link" value={media} onChange={(e) => setMedia(e.target.value)} /></div>
          <div className="frow"><button className="greenbtn wide" disabled={busy || (!body.trim() && !media.trim())}>Post Reply</button>
            <button type="button" className="yellowbtn wide" disabled title="NFT minting is on the roadmap">Mint NFT</button></div>
        </form>
      )}

      <div className="frame op">
        <div className="oppic">
          {post.mediaUri ? <Media url={post.mediaUri} blur={blur} /> : <div className="thumb glyphbox"><span className="glyph">{post.title.slice(0, 1).toUpperCase()}</span></div>}
          <div className="vrow">
            <button className="emo" disabled={!can || post.archived} onClick={() => run("Upvote", (a) => a.vote(post, 1, true))}>👍</button>
            <button className={"time" + (c.urgent ? " urgent" : "")} onClick={() => setPopup(true)}>{post.archived ? "ARCH" : c.text}</button>
            <button className="emo" disabled={!can || post.archived} onClick={() => run("Downvote", (a) => a.vote(post, 1, false))}>💩</button>
          </div>
        </div>
        <div className="opbody">
          <div className="meta">
            <b className="nm">Anonymous</b> <span title={post.owner.toBase58()}>{shortKey(post.author)}</span> {stamp(post.createdAt.toNumber())} {num(post.id.toString())}
            {post.flair > 0 && <span className="flair">{FLAIRS[post.flair]}</span>}
          </div>
          <div className="icons">
            <span>👍 {pad4(post.upVotes.toString())}</span>
            <span>💩 {pad4(post.downVotes.toString())}</span>
            <button title="Tip the owner in $TIME" disabled={!can} onClick={() => tip(post.owner, "owner")}>💸</button>
            <a title="Share on X" href={tweet(`"${post.title}" is fighting for time on BattleChan ⚔️`)} target="_blank" rel="noreferrer">🐥</a>
            <button title="Report post to admin for review" disabled={!can} onClick={() => run("Report post", (a) => a.report(post))}>🔞{post.reports > 0 ? ` ${post.reports}` : ""}</button>
          </div>
          <h2 className="subject">{post.title}</h2>
          <Body text={post.body} />
          {post.pollOptions.length > 0 && (
            <div className="poll">
              {post.pollOptions.map((o: string, i: number) => {
                const v = post.pollVotes[i];
                const pct = pollTotal ? Math.round((v / pollTotal) * 100) : 0;
                return (
                  <button key={i} className="pollopt" disabled={!can} onClick={() => run("Poll vote", (a) => a.pollVote(post, i))} style={{ ["--pct" as any]: pct + "%" }}>
                    <span>{o}</span><b>{v} · {pct}%</b>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="replies">
        {comments.map((cm) => {
          const mine = !!wallet && cm.author.equals(wallet);
          const eligible = cm.likes >= threshold;
          return (
            <div key={cm.key.toBase58()} className="frame reply" id={"r" + cm.index}>
              <div className="meta">
                <b className="nm">Anonymous</b> <span>{shortKey(cm.author)}</span> {stamp(cm.createdAt.toNumber())}{" "}
                <button className="link idbtn" onClick={() => setBody((b) => `${b}${b ? "\n" : ""}>${num(cm.index + 1)}\n`)}>{num(cm.index + 1)}</button>
                {cm.author.equals(post.author) && <span className="oplabel">OP</span>}
              </div>
              <div className="icons">
                <button disabled={!can || mine} title="Like (free)" onClick={() => run("Like", (a) => a.voteComment(post, cm, true)).then(load)}>👍 {pad4(cm.likes)}</button>
                <button disabled={!can || mine} title="Dislike (free)" onClick={() => run("Dislike", (a) => a.voteComment(post, cm, false)).then(load)}>💩 {pad4(cm.dislikes)}</button>
                <button disabled={!can || mine} title="Tip this commenter in $TIME" onClick={() => tip(cm.author, "commenter")}>💸</button>
                <a title="Share on X" href={tweet(`${cm.body.slice(0, 100)} — on BattleChan`)} target="_blank" rel="noreferrer">🐥</a>
                {eligible && <span className="oplabel" title={`${threshold}+ likes: shares the commenter pot`}>pot-eligible</span>}
                {mine && eligible && <button className="greenbtn small" disabled={busy} onClick={() => run("Claim comment reward", (a) => a.claimCommentReward(post, cm)).then(load)}>Claim $TIME</button>}
              </div>
              <Body text={cm.body} />
              {cm.mediaUri && <Media url={cm.mediaUri} blur={blur} />}
            </div>
          );
        })}
        {comments.length === 0 && <p className="center muted">No replies yet.</p>}
      </div>
      {popup && <TimePopup post={post} onClose={() => setPopup(false)} />}
    </section>
  );
}
