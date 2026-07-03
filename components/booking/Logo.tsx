// Original pitch-grid mark (no copyrighted logos).
export default function Logo({
  size = 32,
  color = 'var(--color-primary)',
  label = 'MYATHIDA',
}: {
  size?: number
  color?: string
  label?: string
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className="shrink-0">
        <rect x="2" y="6" width="36" height="28" rx="3" stroke={color} strokeWidth="2.5" />
        <line x1="20" y1="6" x2="20" y2="34" stroke={color} strokeWidth="1.5" />
        <circle cx="20" cy="20" r="4.5" stroke={color} strokeWidth="1.5" />
        <circle cx="20" cy="20" r="1.3" fill={color} />
        <path d="M2 14 L7 14 L7 26 L2 26" stroke={color} strokeWidth="1.5" />
        <path d="M38 14 L33 14 L33 26 L38 26" stroke={color} strokeWidth="1.5" />
      </svg>
      {label && (
        <span
          className="font-display font-extrabold tracking-[0.04em]"
          style={{ fontSize: size * 0.5, color: color === 'var(--color-primary)' ? 'var(--color-text-primary)' : color }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
