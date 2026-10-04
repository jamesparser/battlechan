/** Original BattleChan mark: crossed swords over a clover, drawn inline so there is no image dependency. */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="BattleChan" className="logo-svg">
      <rect width="100" height="100" rx="10" fill="#0b0f0a" />
      <g fill="#3fbf5a">
        <circle cx="38" cy="38" r="13" />
        <circle cx="62" cy="38" r="13" />
        <circle cx="38" cy="62" r="13" />
        <circle cx="62" cy="62" r="13" />
      </g>
      <rect x="47" y="58" width="6" height="30" rx="2" fill="#2a8f42" />
      <g stroke="#d9dde3" strokeWidth="5" strokeLinecap="round">
        <line x1="18" y1="14" x2="82" y2="86" />
        <line x1="82" y1="14" x2="18" y2="86" />
      </g>
      <g stroke="#e8b923" strokeWidth="6" strokeLinecap="round">
        <line x1="14" y1="30" x2="30" y2="14" />
        <line x1="86" y1="30" x2="70" y2="14" />
      </g>
    </svg>
  );
}
