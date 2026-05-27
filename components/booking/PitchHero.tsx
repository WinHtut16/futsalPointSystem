// Full-bleed pitch hero with subtle SVG markings (placeholder for real photography).
export default function PitchHero({
  height = 320,
  className = '',
  children,
}: {
  height?: number
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={`relative overflow-hidden text-white ${className}`}
      style={{
        height,
        background:
          'linear-gradient(180deg, oklch(0.20 0.06 156 / 0.65) 0%, oklch(0.18 0.06 156 / 0.85) 100%), repeating-linear-gradient(95deg, oklch(0.30 0.07 152) 0 28px, oklch(0.28 0.07 152) 28px 56px)',
      }}
    >
      <svg
        viewBox="0 0 800 320"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-[0.18]"
      >
        <rect x="40" y="40" width="720" height="240" stroke="#fff" strokeWidth="2.4" fill="none" />
        <line x1="400" y1="40" x2="400" y2="280" stroke="#fff" strokeWidth="2" />
        <circle cx="400" cy="160" r="48" stroke="#fff" strokeWidth="2" fill="none" />
        <rect x="40" y="90" width="80" height="140" stroke="#fff" strokeWidth="2" fill="none" />
        <rect x="680" y="90" width="80" height="140" stroke="#fff" strokeWidth="2" fill="none" />
      </svg>
      {children}
    </div>
  )
}
