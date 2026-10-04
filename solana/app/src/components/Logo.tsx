/** BattleChan mark (shamrock + crossed swords), from the design board. 840x735 source, shown framed like the wireframe. */
export function Logo({ size = 120 }: { size?: number }) {
  return (
    <span className="logo-frame" style={{ ["--logo-h" as any]: size + "px" }}>
      <img src="/logo-mark.png" srcSet="/logo-mark-sm.png 1x, /logo-mark.png 2x" alt="BattleChan" height={size} width={Math.round((size * 840) / 735)} decoding="async" />
    </span>
  );
}

/** Yellow "Buy $TIME" star: SVG so the label always fits inside the shape. */
export function Star({ href }: { href: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 50 : 30;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(52 + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <a className="star" href={href} target="_blank" rel="noreferrer" title="Buy $TIME" aria-label="Buy $TIME">
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <polygon points={pts} fill="#ffe23a" stroke="#111" strokeWidth="2.5" strokeLinejoin="round" />
        <text x="50" y="49" textAnchor="middle" fontSize="15" fontWeight="800" fill="#111">Buy</text>
        <text x="50" y="65" textAnchor="middle" fontSize="15" fontWeight="800" fill="#111">$TIME</text>
      </svg>
    </a>
  );
}
