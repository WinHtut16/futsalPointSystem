export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />

      {/* Search bar */}
      <div className="h-11 w-full bg-gray-200 rounded-xl animate-pulse" />

      {/* Customer list */}
      <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between animate-pulse">
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-4 w-16 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
