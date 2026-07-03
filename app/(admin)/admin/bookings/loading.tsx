export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />

      {/* Stats bar skeleton */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="h-7 w-16 animate-pulse rounded bg-gray-200" />
            <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Filter strip */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-gray-200" />
        ))}
      </div>

      {/* Bookings table (desktop) */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm md:block">
        <div className="flex gap-4 border-b border-gray-100 px-4 py-3">
          {[80, 120, 80, 80, 60, 60].map((w, i) => (
            <div key={i} className={`h-3 w-${w} animate-pulse rounded bg-gray-200`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
              <div className="space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
            <div className="ml-auto flex flex-1 items-center justify-between gap-4">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
              <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-5 w-9 animate-pulse rounded-full bg-gray-200" />
              <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
