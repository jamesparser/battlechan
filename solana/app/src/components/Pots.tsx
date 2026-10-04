import { fmtTime, toNum } from "../lib/format";

export function Pots({ post, cfg }: { post: any; cfg: any }) {
  const bps = cfg?.opShareBps ?? 7500;
  const pot = toNum(post.pot);
  const opPot = Math.floor((pot * bps) / 10000);
  const cPot = pot - opPot;
  const opLeft = opPot - toNum(post.opWithdrawn);
  const cLeft = cPot - toNum(post.commenterPaid);
  return (
    <div className="pots">
      <div className="pot op"><span>Creator pot ({bps / 100}%)</span><b>{fmtTime(opLeft)}</b></div>
      <div className="pot cm"><span>Top commenters ({100 - bps / 100}%)</span><b>{fmtTime(cLeft)}</b></div>
      <div className="pot dao"><span>To DAO (downvotes)</span><b>{fmtTime(post.daoFromDown)}</b></div>
      <div className="pot burn"><span>🔥 Burned</span><b>{fmtTime(post.burnedFromDown)}</b></div>
    </div>
  );
}
