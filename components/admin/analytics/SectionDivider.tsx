interface SectionDividerProps {
  label: React.ReactNode
  color: string
}

export default function SectionDivider({ label, color }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap"
        style={{ color }}
      >
        {label}
      </span>
      <span className="flex-1 h-px" style={{ backgroundColor: `${color}40` }} />
    </div>
  )
}
