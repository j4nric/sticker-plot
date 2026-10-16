/** Skizze: Die Etikettkanten schneiden die Skalen bei −2 (X) und −1 (Y). */
export function CrosshairHelp() {
  return (
    <svg viewBox="0 0 160 110" className="h-auto w-full max-w-xs" role="img" aria-label="Beispiel: Die linke Etikettkante schneidet die waagerechte Skala bei minus 2, die obere Kante die senkrechte Skala bei minus 1">
      <rect x="0" y="0" width="160" height="110" fill="#f5f5f4" />
      {/* echtes Etikett */}
      <path d="M40 30 H160 V110 H40 Z" fill="#fff" stroke="#57534e" strokeWidth="1.5" />
      <text x="100" y="100" fontSize="9" textAnchor="middle" fill="#78716c">
        Etikett
      </text>
      {/* gedrucktes Kreuz, 2 mm rechts, 1 mm unten (1 mm = 8 px) */}
      <g stroke="#b91c1c" strokeWidth="1.2">
        <line x1="16" y1="38" x2="96" y2="38" />
        <line x1="56" y1="-2" x2="56" y2="78" />
        {Array.from({ length: 9 }, (_, i) => i - 4).map((i) =>
          i === 0 ? null : (
            <g key={i}>
              <line x1={56 + i * 8} y1="38" x2={56 + i * 8} y2={i % 5 === 0 ? 30 : 34} />
              <line x1="56" y1={38 + i * 8} x2={i % 5 === 0 ? 48 : 52} y2={38 + i * 8} />
            </g>
          ),
        )}
        <circle cx="56" cy="38" r="2.5" fill="none" />
      </g>
      <text x="4" y="18" fontSize="9" fill="#b91c1c">
        Kreuzmitte
      </text>
      <text x="62" y="22" fontSize="9" fill="#1c1917">
        Kante bei −2 → X: −2
      </text>
      <text x="62" y="58" fontSize="9" fill="#1c1917">
        Kante bei −1 → Y: −1
      </text>
    </svg>
  );
}
