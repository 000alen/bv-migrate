export function BobAvatar({ size = 52 }: { size?: number }) {
  const h = Math.round((size * 80) / 60);
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 60 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bob the Builder"
    >
      {/* Hard hat dome */}
      <path
        d="M15 23 Q15 9 30 9 Q45 9 45 23 Z"
        fill="#F9FB75"
        stroke="#1a1a1a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Hard hat brim */}
      <rect
        x="7"
        y="21"
        width="46"
        height="5"
        rx="2.5"
        fill="#F9FB75"
        stroke="#1a1a1a"
        strokeWidth="1.5"
      />
      {/* Head */}
      <circle cx="30" cy="34" r="11" fill="#FFCFA6" stroke="#1a1a1a" strokeWidth="2" />
      {/* Eyes */}
      <circle cx="26" cy="32" r="2" fill="#1a1a1a" />
      <circle cx="34" cy="32" r="2" fill="#1a1a1a" />
      {/* Smile */}
      <path
        d="M25 38 Q30 43 35 38"
        stroke="#1a1a1a"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Body */}
      <line x1="30" y1="45" x2="30" y2="64" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
      {/* Left arm */}
      <line x1="30" y1="51" x2="16" y2="61" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      {/* Right arm */}
      <line x1="30" y1="51" x2="44" y2="61" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      {/* Wrench in right hand */}
      <circle cx="47" cy="63" r="3" fill="none" stroke="#CE99F2" strokeWidth="2" />
      <line x1="44" y1="61" x2="47" y2="63" stroke="#CE99F2" strokeWidth="2" strokeLinecap="round" />
      {/* Left leg */}
      <line x1="30" y1="64" x2="22" y2="78" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      {/* Right leg */}
      <line x1="30" y1="64" x2="38" y2="78" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
