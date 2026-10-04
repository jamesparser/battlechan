import { useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useStore } from "../store";
import { clock } from "./Board";
import { Pots } from "./Pots";
import { fmtTime, shortKey, toNum } from "../lib/format";
import { toBase } from "../lib/actions";

/** The "time display pop-up": click a post's clock. Creators withdraw tokens/minutes here; everyone can bulk-vote. */
export function TimePopup({ post, onClose }: { post: any; onClose: () => void }) {
  const { now, cfg, run, busy, wallet, profile } = useStore();
  const [amt, setAmt] = useState("");
  const [votes, setVotes] = useState(5);
  const c = clock(post.expiresAt.toNumber(), now);
  const isOwner = !!wallet && post.owner.equals(wallet);
  const bps = cfg?.opShareBps ?? 7500;
  const avail = Math.floor((toNum(post.pot) * bps) / 10000) - toNum(post.opWithdrawn);
  const initialDone = cfg ? now >= post.createdAt.toNumber() + toNum(cfg.initialSecs) : false;
  const can = !!wallet && !!profile && !busy;
  return (
    <div className="modal" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <div className="bigclock">{post.archived ? "ARCHIVED" : c.text}</div>
        <div className="muted">#{post.id.toString()} · owner {shortKey(post.owner)}</div>
        <Pots post={post} cfg={cfg} />
        {!post.archived && (
          <div className="frow">
            <input type="number" min={1} max={999} value={votes} onChange={(e) => setVotes(Math.max(1, Number(e.target.value) || 1))} />
            <button className="emo big" disabled={!can} onClick={() => run(`Upvote ×${votes}`, (a) => a.vote(post, votes, true))}>👍 +{votes}m</button>
            <button className="emo big" disabled={!can} onClick={() => run(`Downvote ×${votes}`, (a) => a.vote(post, votes, false))}>💩 −{votes}m</button>
          </div>
        )}
        {isOwner && (
          <>
            <p className="muted">Withdrawable: <b>{fmtTime(avail)}</b> $TIME{initialDone ? " (each token withdrawn also removes a minute)." : " — unlocks after the first 5 minutes."}</p>
            <div className="frow">
              <input type="number" min={0} step="0.1" placeholder="amount (blank = all)" value={amt} onChange={(e) => setAmt(e.target.value)} />
            </div>
          </>
        )}
        <div className="popbtns">
          {isOwner && (
            <button className="greenbtn" disabled={busy || !initialDone || avail <= 0}
              onClick={async () => { if (await run("Withdraw $TIME", (a) => a.opWithdraw(post, amt ? toBase(Number(amt)) : new BN(avail)))) onClose(); }}>
              Withdraw
            </button>
          )}
          <button className="redbtn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
