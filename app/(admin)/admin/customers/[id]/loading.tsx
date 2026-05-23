export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Back link */}
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />

      {/* Customer info */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2 animate-pulse">
        <div className="h-6 w-36 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-100 rounded" />
        <div className="h-10 w-32 bg-gray-200 rounded mt-3" />
      </div>

      {/* Add points */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4 animate-pulse">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
        <div className="h-9 w-full bg-gray-200 rounded-xl" />
      </div>

      {/* Reset password */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4 animate-pulse">
        <div className="h-5 w-36 bg-gray-200 rounded" />
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
        <div className="h-9 w-full bg-gray-200 rounded-xl" />
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl shadow-sm p-0 animate-pulse">
        <div className="h-5 w-36 bg-gray-200 rounded mx-4 mt-4 mb-2" />
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

      {/* Danger zone */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3 animate-pulse">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-9 w-40 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}
