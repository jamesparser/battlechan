import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

/** Demo mode (?demo) — sample data so the UI can be reviewed without a deployed program. */
export const demo = { on: typeof location !== "undefined" && new URLSearchParams(location.search).has("demo") };

const bn = (n: number) => new BN(n);
const key = (seed: number) => Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey;
const owner = key(7);

function art(emoji: string, a: string, b: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='200' height='200' fill='url(#g)'/><text x='100' y='128' font-size='96' text-anchor='middle'>${emoji}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

const now = Math.floor(Date.now() / 1000);
const specs: [string, string, string, string, number, number, number, number][] = [
  // title, emoji, colorA, colorB, minutes left, up, down, comments
  ["Solana TPS is the only metric that matters", "⚡", "#3a0ca3", "#4cc9f0", 42, 31, 4, 12],
  ["Show your desk setup", "🖥️", "#264653", "#2a9d8f", 17, 18, 2, 9],
  ["Why is nobody talking about local-first apps", "📡", "#7b2cbf", "#e0aaff", 63, 44, 9, 21],
  ["Unpopular opinion: tabs > spaces", "⌨️", "#e76f51", "#f4a261", 8, 12, 15, 33],
  ["Cambodia coworking spots, ranked", "🌴", "#2d6a4f", "#95d5b2", 29, 25, 1, 7],
  ["Rate my trading journal", "📈", "#d00000", "#ffba08", 5, 9, 3, 4],
  ["Free GPU hour thread", "🔥", "#ff5400", "#ffbd00", 51, 38, 6, 16],
  ["What are you building this weekend", "🛠️", "#023e8a", "#90e0ef", 23, 20, 0, 11],
  ["Hot take: karma should be tradable", "🪙", "#6a040f", "#faa307", 12, 27, 11, 25],
  ["Meme dump", "🐸", "#386641", "#a7c957", 3, 14, 7, 6],
  ["Best noodle soup in BKK1", "🍜", "#bc4749", "#f2e8cf", 36, 16, 2, 8],
  ["Minute-by-minute: this post will die", "☠️", "#212529", "#6c757d", 1, 2, 19, 5],
];

export const demoCfg: any = {
  admin: owner, initialSecs: bn(300), voteSecs: bn(60), voteCost: bn(1_000_000), opShareBps: 7500, quorum: bn(1),
  totalBurned: bn(1_840_000), totalToDao: bn(1_840_000),
};

export const demoCats: any[] = [
  { key: key(1), id: 0, name: "General", slots: [] as PublicKey[], next: 0 },
  { key: key(2), id: 1, name: "Tech", slots: [] as PublicKey[], next: 0 },
  { key: key(3), id: 2, name: "Memes", slots: [] as PublicKey[], next: 0 },
];

export const demoPosts: any[] = specs.map((s, i) => {
  const k = key(20 + i);
  demoCats[i < 8 ? 0 : i < 10 ? 1 : 2].slots.push(k);
  return {
    key: k, id: bn(i + 1), category: i < 8 ? 0 : i < 10 ? 1 : 2, owner, author: owner, title: s[0], body:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n>#0000000000001\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    mediaUri: art(s[1], s[2], s[3]), createdAt: bn(now - 600 - i * 120), expiresAt: bn(now + s[4] * 60),
    upVotes: bn(s[5]), downVotes: bn(s[6]), commentCount: s[7], pot: bn(s[5] * 1_000_000), opWithdrawn: bn(0), commenterPaid: bn(0),
    daoFromDown: bn(s[6] * 500_000), burnedFromDown: bn(s[6] * 500_000), archived: false, flair: 0, reports: 0,
    pollOptions: [] as string[], pollVotes: [] as number[],
  };
});
// pad slot arrays to the program's cap with default keys
demoCats.forEach((c) => { while (c.slots.length < 125) c.slots.push(PublicKey.default); });

export const demoComments = (post: any): any[] =>
  ["first", "this is the way", ">#0000000000001 based", "mods asleep, post memes", "lol", "bump"].slice(0, Math.min(6, post.commentCount)).map((t, i) => ({
    key: key(100 + i), index: i, author: key(50 + i), createdAt: bn(now - 300 + i * 40), body: t, mediaUri: "", likes: i * 3, dislikes: i % 2, paid: false,
  }));
