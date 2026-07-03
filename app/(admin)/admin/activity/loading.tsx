export default function ActivityLogLoading() {
  return (
    <div className="space-y-5">
      {/* Header skeleton */}
      <div className="space-y-1.5">
        <div className="h-7 w-40 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-4 w-64 rounded bg-gray-100 animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[60, 76, 56, 72].map((w, i) => (
          <div
            key={i}
            className="h-6 rounded-full bg-gray-200 animate-pulse shrink-0"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Count skeleton */}
      <div className="h-3.5 w-44 rounded bg-gray-100 animate-pulse" />

      {/* Row skeletons */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse mt-2 shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="h-4 w-3/5 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-1/4 rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="h-3 w-28 rounded bg-gray-100 animate-pulse shrink-0 mt-1" />
          </div>
        ))}
      </div>
    </div>
  )
}
