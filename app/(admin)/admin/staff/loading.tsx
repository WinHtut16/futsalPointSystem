export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-3 w-36 bg-gray-100 rounded" />
            </div>
            <div className="h-5 w-12 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
