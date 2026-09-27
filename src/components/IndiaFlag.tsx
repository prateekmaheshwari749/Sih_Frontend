interface IndiaFlagProps {
  className?: string;
  title?: string;
}

export default function IndiaFlag({
  className = 'w-4 h-2.5',
  title = 'National Flag of India (Tiranga)',
}: IndiaFlagProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 225 150"
      className={`inline-block shrink-0 rounded-[2px] overflow-hidden shadow-xs border border-slate-300/40 ${className}`}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Top Band: Deep Saffron (Kesari) */}
      <rect width="225" height="50" fill="#FF9933" />

      {/* Middle Band: White */}
      <rect y="50" width="225" height="50" fill="#FFFFFF" />

      {/* Bottom Band: India Green */}
      <rect y="100" width="225" height="50" fill="#138808" />

      {/* Ashoka Chakra (Navy Blue Wheel with 24 Spokes) in Center */}
      <g transform="translate(112.5, 75)">
        {/* Outer Wheel Rim */}
        <circle r="19.5" fill="none" stroke="#000080" strokeWidth="2.2" />
        {/* Center Hub */}
        <circle r="3.8" fill="#000080" />
        {/* 24 Radial Spokes */}
        {Array.from({ length: 24 }).map((_, i) => (
          <line
            key={i}
            x1="0"
            y1="0"
            x2="0"
            y2="-19.5"
            stroke="#000080"
            strokeWidth="1.2"
            transform={`rotate(${i * 15})`}
          />
        ))}
      </g>
    </svg>
  );
}
