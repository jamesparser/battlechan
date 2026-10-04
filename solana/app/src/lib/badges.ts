export interface Badge {
  id: string;
  label: string;
  emoji: string;
  group: "join" | "comments" | "posts" | "wealth" | "popularity";
}

function tiers(n: number, steps: number[]) {
  return steps.filter((s) => n >= s);
}

/** All badges are derived from on-chain profile counters + $TIME balance, so they can never be faked. */
export function computeBadges(profile: any, timeBalance: number): Badge[] {
  if (!profile) return [];
  const out: Badge[] = [];
  const year = new Date(profile.joinedAt.toNumber() * 1000).getUTCFullYear();
  if (year <= 2025) out.push({ id: "og25", label: "2025 OG", emoji: "🏛️", group: "join" });
  else out.push({ id: `og${year}`, label: `${year} Day-One`, emoji: "🚀", group: "join" });

  for (const s of tiers(profile.comments, [10, 50, 100, 1000]))
    out.push({ id: `c${s}`, label: `${s.toLocaleString()} comments`, emoji: "💬", group: "comments" });
  for (const s of tiers(profile.posts, [10, 50, 100, 1000]))
    out.push({ id: `p${s}`, label: `${s.toLocaleString()} posts`, emoji: "📝", group: "posts" });

  const wealth: [number, string, string][] = [
    [100_000_000, "Whale", "🐋"],
    [1_000_000_000, "Humpback", "🐳"],
  ];
  // exactly one wealth badge: highest tier reached
  const ladder: [number, string, string][] = [
    [0, "Shrimp", "🦐"],
    [10, "Crab", "🦀"],
    [1_000, "Octopus", "🐙"],
    [10_000, "Fish", "🐟"],
    [100_000, "Dolphin", "🐬"],
    [1_000_000, "Shark", "🦈"],
    ...wealth,
  ].sort((a, b) => (a[0] as number) - (b[0] as number)) as [number, string, string][];
  let w = ladder[0];
  for (const l of ladder) if (timeBalance > l[0]) w = l;
  out.push({ id: `w${w[1]}`, label: w[1], emoji: w[2], group: "wealth" });

  for (const s of tiers(profile.maxPostUpVotes.toNumber(), [100, 1000]))
    out.push({ id: `pu${s}`, label: `${s.toLocaleString()} likes on a post`, emoji: "🔥", group: "popularity" });
  for (const s of tiers(profile.maxCommentLikes, [100, 1000]))
    out.push({ id: `cl${s}`, label: `${s.toLocaleString()} likes on a comment`, emoji: "⭐", group: "popularity" });
  for (const s of tiers(profile.maxCommentDislikes, [100, 1000]))
    out.push({ id: `cd${s}`, label: `${s.toLocaleString()} dislikes on a comment`, emoji: "💀", group: "popularity" });
  return out;
}

export function apyPct(profile: any): number {
  if (!profile) return 3;
  const t = (n: number) => (n >= 10 ? 1 : 0) + (n >= 50 ? 1 : 0) + (n >= 100 ? 2 : 0) + (n >= 1000 ? 3 : 0);
  return Math.min(10, 3 + t(profile.comments) + t(profile.posts));
}

export const FLAIRS = [
  "", "🔥 Hot take", "🧠 Big brain", "🐸 Based", "💎 Diamond", "👑 Royal", "⚡ Breaking", "🏴‍☠️ Raid", "🌈 Rainbow",
];
export const DECORATIONS = ["", "Neon", "Gold", "Glitch", "Matrix", "Sakura", "Flame", "Ice", "Cosmic"];
export const CATEGORY_HINTS = ["Politics", "Business", "Games", "Crypto", "Tech", "Memes", "Random"];

/** Holiday / event backgrounds ("dynamic themes"). */
export function seasonalTheme(d = new Date()): { name: string; accent: string; accent2: string; glyph: string } {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 10) return { name: "Spooky Season", accent: "#ff7a1a", accent2: "#7a3cff", glyph: "🎃" };
  if (m === 12) return { name: "Winter Fest", accent: "#46c2ff", accent2: "#ff4d6d", glyph: "❄️" };
  if (m === 2 && day <= 14) return { name: "Love Battle", accent: "#ff4d8d", accent2: "#ffb3c7", glyph: "💘" };
  if (m === 7 && day === 4) return { name: "Fireworks", accent: "#ff3b3b", accent2: "#3b7bff", glyph: "🎆" };
  return { name: "Classic Arena", accent: "#ffd23f", accent2: "#ff4d6d", glyph: "⚔️" };
}
