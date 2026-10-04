import { useEffect, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useStore } from "../store";
import { fmtDur, fmtKarma, fmtTime, shortKey, toNum } from "../lib/format";

const PARAMS: { id: number; label: string; hint: string }[] = [
  { id: 0, label: "Vote cost", hint: "$TIME base units (1e6 = 1 $TIME)" },
  { id: 1, label: "Seconds per vote", hint: "seconds" },
  { id: 2, label: "Initial visibility", hint: "seconds" },
  { id: 3, label: "Owner share", hint: "basis points (7500 = 75%)" },
  { id: 4, label: "Karma bomb cost", hint: "$KARMA base units (1e6 = 1)" },
  { id: 5, label: "Resurrect cost", hint: "$KARMA base units (1e6 = 1)" },
  { id: 6, label: "Likes for karma/payout", hint: "likes" },
  { id: 7, label: "Faucet amount", hint: "base units" },
  { id: 8, label: "Voting period", hint: "seconds" },
  { id: 9, label: "Quorum", hint: "base units" },
  { id: 10, label: "Withdraw penalty", hint: "seconds per vote-worth withdrawn" },
];

export function DaoPage() {
  const { actions, cfg, wallet, run, busy, now, balance } = useStore();
  const [props, setProps] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [kind, setKind] = useState(0);
  const [param, setParam] = useState(0);
  const [value, setValue] = useState("");
  const [recipient, setRecipient] = useState("");

  const load = async () => {
    if (!actions) return;
    const all = await actions.program.account.proposal.all();
    setProps(all.map((x: any) => x.account).sort((a: any, b: any) => b.id.toNumber() - a.id.toNumber()));
  };
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [actions]);

  if (!cfg) return null;
  const minBal = toNum(cfg.proposalMinBalance) / 1e6;

  return (
    <section>
      <div className="frame">
        <h2>BattleChan DAO</h2>
        <p className="muted">
          Token holders govern every platform parameter and the treasury. Vote weight = your $TIME balance when you vote.
          Quorum {fmtTime(cfg.quorum, 0)} $TIME. Proposing requires {minBal.toLocaleString()} $TIME.
        </p>
        <div className="statgrid">
          <div><b>{fmtTime(cfg.totalBurned)}</b><span>$TIME burned</span></div>
          <div><b>{fmtTime(cfg.totalToDao)}</b><span>from downvotes to DAO</span></div>
          <div><b>{fmtKarma(cfg.karmaTreasury)}</b><span>$KARMA returned to DAO</span></div>
          <div><b>{fmtKarma(cfg.karmaMinted)}</b><span>$KARMA minted / 1T</span></div>
        </div>
      </div>

      {wallet && (
        <form className="frame" onSubmit={async (e) => {
          e.preventDefault();
          const rec = kind === 1 ? new PublicKey(recipient) : PublicKey.default;
          if (await run("Create proposal", (a) => a.createProposal(title, desc, kind, param, new BN(value || "0"), rec))) {
            setTitle(""); setDesc(""); setValue(""); load();
          }
        }}>
          <h3>New proposal</h3>
          <input maxLength={64} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea maxLength={256} rows={2} placeholder="Why?" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="row wrap">
            <select value={kind} onChange={(e) => setKind(Number(e.target.value))}>
              <option value={0}>Change a parameter</option>
              <option value={1}>Spend from treasury</option>
            </select>
            {kind === 0 && (
              <select value={param} onChange={(e) => setParam(Number(e.target.value))}>
                {PARAMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
            {kind === 1 && <input placeholder="Recipient wallet" value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} required />}
            <input type="number" min={0} placeholder={kind === 0 ? PARAMS[param].hint : "amount, base units (1e6 = 1 $TIME)"} value={value} onChange={(e) => setValue(e.target.value)} required />
            <button className="primary" disabled={busy || balance < minBal}>Submit</button>
          </div>
        </form>
      )}

      {props.map((p) => {
        const ended = now >= p.endTs.toNumber();
        const total = toNum(p.yes) + toNum(p.no);
        const pct = total ? Math.round((toNum(p.yes) / total) * 100) : 0;
        const passes = toNum(p.yes) > toNum(p.no) && total >= toNum(cfg.quorum);
        return (
          <div key={p.id.toString()} className="frame">
            <div className="row between">
              <h3>#{p.id.toString()} {p.title}</h3>
              <span className="chip2">{p.executed ? "executed" : ended ? (passes ? "passed" : "failed") : `ends in ${fmtDur(p.endTs.toNumber() - now)}`}</span>
            </div>
            <p className="muted">{p.description}</p>
            <p>
              {p.kind === 0
                ? <>Set <b>{PARAMS.find((x) => x.id === p.param)?.label}</b> → <b>{p.value.toString()}</b></>
                : <>Send <b>{fmtTime(p.value)}</b> $TIME to {shortKey(p.recipient)}</>}
              {" "}· by {shortKey(p.proposer)}
            </p>
            <div className="bar-yes"><i style={{ width: pct + "%" }} /></div>
            <div className="row wrap">
              <span>Yes {fmtTime(p.yes, 0)} · No {fmtTime(p.no, 0)}</span>
              {!ended && wallet && (
                <>
                  <button disabled={busy} onClick={() => run("Vote yes", (a) => a.daoVote(p, true)).then(load)}>Vote yes</button>
                  <button disabled={busy} onClick={() => run("Vote no", (a) => a.daoVote(p, false)).then(load)}>Vote no</button>
                </>
              )}
              {ended && !p.executed && passes && wallet && (
                <button className="primary" disabled={busy} onClick={() => run("Execute proposal", (a) => a.executeProposal(p)).then(load)}>Execute</button>
              )}
            </div>
          </div>
        );
      })}
      {props.length === 0 && <div className="frame center">No proposals yet.</div>}
    </section>
  );
}
