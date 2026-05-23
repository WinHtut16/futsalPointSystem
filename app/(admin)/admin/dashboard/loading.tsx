export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />

      {/* Primary KPIs */}
      <div>
        <div className="h-3 w-36 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-3 text-center space-y-2 animate-pulse">
              <div className="h-8 w-20 bg-gray-200 rounded mx-auto" />
              <div className="h-3 w-24 bg-gray-100 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Secondary KPIs */}
      <div>
        <div className="h-3 w-28 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-3 text-center space-y-2 animate-pulse">
              <div className="h-8 w-20 bg-gray-200 rounded mx-auto" />
              <div className="h-3 w-24 bg-gray-100 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Pending banner */}
      <div className="h-10 w-full bg-gray-200 rounded-xl animate-pulse" />

      {/* Charts 2×2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-4 space-y-3 animate-pulse">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-36 w-full bg-gray-100 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl shadow-sm p-0 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mx-4 mt-4 mb-2" />
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
              <div className="h-5 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
