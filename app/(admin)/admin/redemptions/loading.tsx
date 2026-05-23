export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-44 bg-gray-200 rounded animate-pulse" />

      <div className="space-y-4">
        {/* Pending badge + search */}
        <div className="h-6 w-28 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-11 w-full bg-gray-200 rounded-xl animate-pulse" />

        {/* Redemption request cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-4 space-y-4 animate-pulse">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="h-5 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
                <div className="h-3 w-24 bg-gray-100 rounded" />
              </div>
              <div className="text-right space-y-1.5">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded ml-auto" />
                <div className="h-3 w-12 bg-gray-100 rounded ml-auto" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-gray-100 rounded-xl" />
              <div className="flex-1 h-9 bg-gray-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
