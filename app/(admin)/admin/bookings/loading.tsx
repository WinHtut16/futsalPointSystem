export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />

      {/* Filter strip */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-200 rounded-full animate-pulse" />
        ))}
      </div>

      {/* Bookings table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-gray-100 animate-pulse">
          {[32, 24, 20, 28, 20, 16].map((w, i) => (
            <div key={i} className={`h-3 w-${w} bg-gray-200 rounded`} />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 px-4 py-3.5 border-b border-gray-50 items-center animate-pulse">
            {/* Ref */}
            <div className="h-3.5 w-20 bg-gray-200 rounded" />
            {/* Customer */}
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-2.5 w-16 bg-gray-100 rounded" />
            </div>
            {/* Date */}
            <div className="h-3 w-20 bg-gray-100 rounded" />
            {/* Hours */}
            <div className="h-3 w-16 bg-gray-100 rounded" />
            {/* Status badge */}
            <div className="h-5 w-20 bg-gray-200 rounded-full" />
            {/* Action buttons */}
            <div className="flex gap-1.5">
              <div className="h-7 w-16 bg-gray-100 rounded-lg" />
              <div className="h-7 w-16 bg-gray-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
