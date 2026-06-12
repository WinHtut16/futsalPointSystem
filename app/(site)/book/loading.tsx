export default function BookLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-6 md:px-16">
      <div className="mb-4 h-20 rounded-[var(--r-lg)] bg-surface-alt" />
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="h-14 rounded-[var(--r-lg)] bg-surface-alt" />
        <div className="h-14 rounded-[var(--r-lg)] bg-surface-alt" />
        <div className="h-14 rounded-[var(--r-lg)] bg-surface-alt" />
      </div>
      <div className="mb-4 h-72 rounded-[var(--r-lg)] bg-surface-alt" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 rounded-[var(--r-md)] bg-surface-alt" />
        ))}
      </div>
    </div>
  )
}
