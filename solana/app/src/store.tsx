import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";
import { connection, explorer, getProgram, pda, readonlyProgram } from "./lib/chain";
import { Actions } from "./lib/actions";
import { demo, demoCats, demoCfg, demoPosts } from "./lib/demo";

export interface Toast {
  id: number;
  kind: "ok" | "err" | "info";
  text: string;
  href?: string;
}

interface Ctx {
  cfg: any | null;
  cats: any[];
  posts: any[]; // {key, ...account}
  profile: any | null;
  balance: number; // whole $TIME
  karmaWallet: number; // liquid (unstaked) $KARMA tokens, whole units
  now: number;
  actions: Actions | null;
  wallet: PublicKey | null;
  loading: boolean;
  initialized: boolean;
  refresh: () => Promise<void>;
  run: <T>(label: string, fn: (a: Actions) => Promise<string>) => Promise<boolean>;
  toasts: Toast[];
  dismiss: (id: number) => void;
  busy: boolean;
}

const C = createContext<Ctx>(null as any);
export const useStore = () => useContext(C);

function niceError(e: any): string {
  const m =
    e?.error?.errorMessage ||
    e?.message ||
    String(e);
  if (/User rejected/i.test(m)) return "Transaction rejected in wallet";
  if (/insufficient funds/i.test(m) || /0x1\b/.test(m)) return "Not enough SOL or $TIME for that. Try the faucet.";
  if (/already in use/i.test(m)) return "You already did that (account exists).";
  return m.length > 220 ? m.slice(0, 220) + "…" : m;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const w = useWallet();
  const [cfg, setCfg] = useState<any>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [karmaWallet, setKarmaWallet] = useState(0);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const tid = useRef(1);

  useEffect(() => {
    const i = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(i);
  }, []);

  const walletKey = w.publicKey;
  const actions = useMemo(() => {
    if (!walletKey || !w.signTransaction) return null;
    const prog = getProgram({
      publicKey: walletKey,
      signTransaction: w.signTransaction,
      signAllTransactions: w.signAllTransactions,
    });
    return new Actions(prog, walletKey);
  }, [walletKey, w.signTransaction, w.signAllTransactions]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = tid.current++;
    setToasts((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 9000);
  }, []);
  const dismiss = (id: number) => setToasts((x) => x.filter((y) => y.id !== id));

  const refresh = useCallback(async () => {
    if (demo.on) { setInitialized(true); setCfg(demoCfg); setCats(demoCats); setPosts(demoPosts); setLoading(false); return; }
    const prog = actions?.program ?? readonlyProgram();
    try {
      const c = await prog.account.config.fetchNullable(pda.config());
      if (!c) {
        // program not deployed on this cluster yet: show sample data so the UI is reviewable
        demo.on = true;
        setInitialized(true); setCfg(demoCfg); setCats(demoCats); setPosts(demoPosts); setLoading(false);
        return;
      }
      setInitialized(true);
      setCfg(c);
      const [catAll, postAll] = await Promise.all([prog.account.category.all(), prog.account.post.all()]);
      setCats(catAll.map((x: any) => ({ key: x.publicKey, ...x.account })).sort((a: any, b: any) => a.id - b.id));
      setPosts(postAll.map((x: any) => ({ key: x.publicKey, ...x.account })));
      if (walletKey) {
        setProfile(await prog.account.userProfile.fetchNullable(pda.profile(walletKey)));
        try {
          const acc = await getAccount(connection, actions!.ata());
          setBalance(Number(acc.amount) / 1e6);
        } catch {
          setBalance(0);
        }
        try {
          const k = await getAccount(connection, actions!.karmaAta());
          setKarmaWallet(Number(k.amount) / 1e6);
        } catch {
          setKarmaWallet(0);
        }
      } else {
        setProfile(null);
        setBalance(0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [actions, walletKey]);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 10000);
    return () => clearInterval(i);
  }, [refresh]);

  const run = useCallback(
    async (label: string, fn: (a: Actions) => Promise<string>) => {
      if (!actions) {
        push({ kind: "err", text: "Connect a wallet first" });
        return false;
      }
      setBusy(true);
      try {
        push({ kind: "info", text: `${label}…` });
        const sig = await fn(actions);
        push({ kind: "ok", text: `${label} ✓`, href: explorer(sig) });
        await refresh();
        return true;
      } catch (e: any) {
        console.error(e);
        push({ kind: "err", text: niceError(e) });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [actions, push, refresh]
  );

  const value: Ctx = {
    cfg, cats, posts, profile, balance, karmaWallet, now, actions, wallet: walletKey, loading, initialized,
    refresh, run, toasts, dismiss, busy,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
