interface LogoProps {
  size?: number;
  showWordmark?: boolean;
}

// The Ember leaf mark. Tagline reads "CONNECT · PLUG" (discover removed).
export default function Logo({ size = 120, showWordmark = true }: LogoProps) {
  const viewW = showWordmark ? 680 : 220;
  return (
    <svg
      width={size}
      viewBox={`0 0 ${viewW} 400`}
      role="img"
      aria-label="Ember"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(60, 80)">
        <path
          d="M60 200 C20 160 0 110 10 60 C20 20 45 5 60 0 C75 5 100 20 110 60 C120 110 100 160 60 200 Z"
          fill="#126c5d"
        />
        <path
          d="M60 185 C45 150 38 110 42 70 C46 40 54 20 60 10"
          fill="none"
          stroke="#1db894"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path d="M60 130 C48 118 38 112 28 110" fill="none" stroke="#1db894" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        <path d="M60 130 C72 118 82 112 92 110" fill="none" stroke="#1db894" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        <path d="M60 100 C50 90 42 86 34 85" fill="none" stroke="#1db894" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        <path d="M60 100 C70 90 78 86 86 85" fill="none" stroke="#1db894" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
        <path d="M60 160 C50 150 43 146 36 145" fill="none" stroke="#1db894" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
        <path d="M60 160 C70 150 77 146 84 145" fill="none" stroke="#1db894" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
        <ellipse cx="60" cy="193" rx="10" ry="6" fill="#ff7b2c" opacity="0.85" />
        <ellipse cx="60" cy="193" rx="6" ry="3.5" fill="#ffb347" opacity="0.9" />
        <ellipse cx="60" cy="192" rx="3" ry="2" fill="#fff5e0" opacity="0.95" />
        <path d="M60 200 C60 210 58 220 56 228" fill="none" stroke="#126c5d" strokeWidth="3" strokeLinecap="round" />
      </g>
      {showWordmark && (
        <>
          <text x="200" y="185" fontFamily="Inter, Arial, sans-serif" fontSize="52" fontWeight="500" fill="#1db894">
            ember
          </text>
          <text x="202" y="215" fontFamily="Inter, Arial, sans-serif" fontSize="14" fontWeight="400" fill="#8a9290" letterSpacing="2">
            CONNECT · PLUG
          </text>
        </>
      )}
    </svg>
  );
}
