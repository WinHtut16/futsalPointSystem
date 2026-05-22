export default function Loading() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-7 w-20 bg-gray-200 rounded-lg animate-pulse" />
      </div>
      <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between animate-pulse">
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
