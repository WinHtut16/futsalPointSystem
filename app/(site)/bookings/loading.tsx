export default function BookingsLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 py-6">
      <div className="h-44 rounded-[var(--r-xl)] bg-surface-alt" />
      <div className="mt-5 flex gap-6">
        <div className="h-5 w-20 rounded bg-surface-alt" />
        <div className="h-5 w-20 rounded bg-surface-alt" />
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-[var(--r-lg)] bg-surface-alt" />
        ))}
      </div>
    </div>
  )
}
