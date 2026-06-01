export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Title + description */}
      <div className="space-y-2">
        <div className="h-7 w-36 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-72 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Add closure form card */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3 animate-pulse">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-gray-100 rounded-xl" />
          <div className="h-10 flex-1 bg-gray-100 rounded-xl" />
          <div className="h-10 w-28 bg-gray-200 rounded-xl" />
        </div>
      </div>

      {/* Closure list */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-4 py-3.5 animate-pulse">
            <div className="space-y-1.5">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-3 w-40 bg-gray-100 rounded" />
            </div>
            <div className="h-8 w-8 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
