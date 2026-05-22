export default function Loading() {
  return (
    <div className="px-4 py-6 space-y-5">
      <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse space-y-3">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-12 w-40 bg-gray-100 rounded" />
        <div className="h-4 w-32 bg-gray-100 rounded" />
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm animate-pulse space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="h-5 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-14 bg-gray-100 rounded" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="space-y-1">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm animate-pulse text-center space-y-3">
        <div className="h-4 w-40 bg-gray-100 rounded mx-auto" />
        <div className="h-9 w-32 bg-gray-200 rounded-xl mx-auto" />
      </div>
    </div>
  )
}
