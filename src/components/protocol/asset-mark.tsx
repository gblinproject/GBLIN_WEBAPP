/**
 * The three reserve assets, drawn as coins.
 *
 * Each mark is the asset's own, because a reader recognises Bitcoin, Ethereum
 * and a dollar faster than any house glyph. They are inline SVG so they stay
 * crisp at any size, cost no request, and carry no tracking.
 */

const SIZE = 100;

function Ring({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <radialGradient id={id} cx="35%" cy="28%" r="78%">
      <stop offset="0%" stopColor={from} />
      <stop offset="100%" stopColor={to} />
    </radialGradient>
  );
}

export function AssetMark({ name, size = 56, className = '' }: { name: string; size?: number; className?: string }) {
  const common = {
    className,
    height: size,
    width: size,
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    'aria-hidden': true as const,
  };

  if (name === 'cbBTC') {
    return (
      <svg {...common}>
        <defs>
          <Ring id="m-btc" from="#ffe9ae" to="#a3762a" />
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#m-btc)" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="#f6e3b0" strokeOpacity=".55" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#6b4a10" strokeOpacity=".28" strokeWidth="1" />
        <g fill="#3a2708" transform="rotate(-14 50 50)">
          <rect height="13" rx="1.6" width="6" x="40" y="17" />
          <rect height="13" rx="1.6" width="6" x="53" y="17" />
          <rect height="13" rx="1.6" width="6" x="40" y="70" />
          <rect height="13" rx="1.6" width="6" x="53" y="70" />
          <text
            dominantBaseline="central"
            fontFamily="var(--font-geist), ui-sans-serif, system-ui, sans-serif"
            fontSize="54"
            fontWeight="700"
            textAnchor="middle"
            x="50"
            y="51"
          >
            B
          </text>
        </g>
      </svg>
    );
  }

  if (name === 'USDC') {
    return (
      <svg {...common}>
        <defs>
          <Ring id="m-usdc" from="#5aa0ec" to="#1b5fa8" />
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#m-usdc)" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="#bcd9f5" strokeOpacity=".5" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="39" fill="none" stroke="#ffffff" strokeOpacity=".3" strokeWidth="2" />
        <text
          dominantBaseline="central"
          fill="#ffffff"
          fontFamily="var(--font-geist), ui-sans-serif, system-ui, sans-serif"
          fontSize="46"
          fontWeight="500"
          textAnchor="middle"
          x="50"
          y="51"
        >
          $
        </text>
      </svg>
    );
  }

  // WETH, and the fallback for anything the basket adds later.
  return (
    <svg {...common}>
      <defs>
        <Ring id="m-eth" from="#3c3c44" to="#131317" />
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#m-eth)" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="#c9c9d2" strokeOpacity=".45" strokeWidth="1.5" />
      <g transform="translate(50 50)">
        <path d="M0 -27 L15 -3 L0 7 L-15 -3 Z" fill="#e6e6ee" fillOpacity=".95" />
        <path d="M0 -27 L15 -3 L0 -9 Z" fill="#a9a9b6" />
        <path d="M0 11 L15 1 L0 27 L-15 1 Z" fill="#e6e6ee" fillOpacity=".8" />
        <path d="M0 11 L15 1 L0 27 Z" fill="#a9a9b6" />
      </g>
    </svg>
  );
}
