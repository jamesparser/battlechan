/** Official BattleChan wordmark (crossed swords as the "T"), served from /logo.png. */
export function Logo({ size = 96 }: { size?: number }) {
  // `size` is the rendered height; the artwork is 158x76.
  const h = Math.round(size * 0.9);
  return <img src="/logo.png" alt="BattleChan" height={h} width={Math.round((h * 158) / 76)} className="logo-img" />;
}
