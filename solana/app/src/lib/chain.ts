import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../idl/battlechan.json";

export const CLUSTER = (import.meta.env.VITE_CLUSTER as string) || "testnet";
export const RPC = (import.meta.env.VITE_RPC as string) || "https://api.testnet.solana.com";
export const PROGRAM_ID = new PublicKey((idl as any).address);
export const TIME_DECIMALS = 6;
export const TIME_UNIT = 10 ** TIME_DECIMALS;
export const KARMA_UNIT = 10 ** 6;
export const CATEGORY_CAP = 125;
export const PAGE1_SIZE = 25;
export const PAGE_SIZE = 25;

const u16 = (n: number) => new BN(n).toArrayLike(Buffer, "le", 2);
const u32 = (n: number) => new BN(n).toArrayLike(Buffer, "le", 4);
const u64 = (n: number | BN) => new BN(n).toArrayLike(Buffer, "le", 8);
const find = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
const s = (x: string) => Buffer.from(x);

export const pda = {
  config: () => find([s("config")]),
  mint: () => find([s("time_mint")]),
  vault: () => find([s("vault")]),
  treasury: () => find([s("treasury")]),
  faucetPool: () => find([s("faucet_pool")]),
  karmaMint: () => find([s("karma_mint")]),
  karmaVault: () => find([s("karma_vault")]),
  karmaTreasury: () => find([s("karma_treasury")]),
  category: (id: number) => find([s("category"), u16(id)]),
  profile: (w: PublicKey) => find([s("profile"), w.toBuffer()]),
  post: (id: number | BN) => find([s("post"), u64(id)]),
  comment: (post: PublicKey, idx: number) => find([s("comment"), post.toBuffer(), u32(idx)]),
  cvote: (comment: PublicKey, voter: PublicKey) => find([s("cvote"), comment.toBuffer(), voter.toBuffer()]),
  pvote: (post: PublicKey, voter: PublicKey) => find([s("pvote"), post.toBuffer(), voter.toBuffer()]),
  report: (post: PublicKey, w: PublicKey) => find([s("report"), post.toBuffer(), w.toBuffer()]),
  proposal: (id: number | BN) => find([s("proposal"), u64(id)]),
  dvote: (proposal: PublicKey, voter: PublicKey) => find([s("dvote"), proposal.toBuffer(), voter.toBuffer()]),
};

export const connection = new Connection(RPC, "confirmed");

export function getProgram(wallet: any): any {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idl as any, provider);
}

export function readonlyProgram(): any {
  const dummy = {
    publicKey: PublicKey.default,
    signTransaction: async (t: any) => t,
    signAllTransactions: async (t: any) => t,
  };
  return getProgram(dummy);
}

export const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`;
export const explorerAddr = (a: string) => `https://explorer.solana.com/address/${a}?cluster=${CLUSTER}`;
