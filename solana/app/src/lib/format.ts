import { BN } from "@coral-xyz/anchor";
import { TIME_UNIT } from "./chain";

export const toNum = (b: BN | number | undefined | null): number =>
  b === undefined || b === null ? 0 : typeof b === "number" ? b : b.toNumber();

export function fmtTime(base: BN | number | undefined, dp = 2): string {
  const v = toNum(base) / TIME_UNIT;
  return v.toLocaleString(undefined, { maximumFractionDigits: dp });
}

export function fmtKarma(base: BN | number | undefined, dp = 2): string {
  const v = toNum(base) / 1_000_000;
  return v.toLocaleString(undefined, { maximumFractionDigits: dp });
}

export function fmtRemaining(expiresAt: number, nowSec: number): { text: string; expired: boolean; urgent: boolean } {
  const left = expiresAt - nowSec;
  if (left <= 0) {
    const ago = -left;
    return { text: `expired ${fmtDur(ago)} ago`, expired: true, urgent: true };
  }
  return { text: fmtDur(left), expired: false, urgent: left < 300 };
}

export function fmtDur(sec: number): string {
  sec = Math.floor(Math.abs(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function shortKey(k: { toBase58(): string } | string): string {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function ago(ts: number, nowSec: number): string {
  const d = nowSec - ts;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export function isVideo(url: string) {
  return /\.(webm|mp4)(\?|$)/i.test(url);
}
