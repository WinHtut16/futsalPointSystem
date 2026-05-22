export default function Loading() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
        <div className="h-7 w-20 bg-gray-200 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm space-y-3 animate-pulse">
            <div className="h-20 w-full bg-gray-100 rounded-xl" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
            <div className="h-8 w-full bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
