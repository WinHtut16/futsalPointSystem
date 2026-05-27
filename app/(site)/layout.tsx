export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] font-body text-ink">
      {children}
    </div>
  )
}
