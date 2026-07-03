// Mirrors the unified account layout: identity row + gradient points strip,
// segmented tabs, then a list of cards.
export default function Loading() {
  return (
    <div>
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="h-[52px] w-[52px] flex-shrink-0 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
        </div>
        <div className="mt-3.5 h-[72px] rounded-[var(--r-lg)] bg-gray-200 animate-pulse" />
      </div>

      <div className="mt-4 flex justify-between border-b border-line px-4 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="my-3 h-4 w-20 rounded bg-gray-100" />
        ))}
      </div>

      <div className="space-y-2.5 px-4 pt-[18px]">
        <div className="mb-3.5 flex items-center justify-between animate-pulse">
          <div className="h-5 w-24 rounded bg-gray-200" />
          <div className="h-9 w-20 rounded-[var(--r-md)] bg-gray-100" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[var(--r-lg)] border border-line bg-white p-4 shadow-sm animate-pulse">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-100" />
              </div>
              <div className="h-6 w-20 rounded-full bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
