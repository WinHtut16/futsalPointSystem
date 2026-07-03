export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Header: title + New Post button */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
        <div className="h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      {/* Post list */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between bg-white rounded-2xl shadow-sm p-4 animate-pulse">
            <div className="min-w-0 space-y-1.5">
              {/* Category + status badges */}
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 bg-gray-200 rounded-full" />
                <div className="h-4 w-14 bg-gray-100 rounded-full" />
              </div>
              {/* Title */}
              <div className="h-4 w-56 bg-gray-200 rounded" />
              {/* Slug */}
              <div className="h-3 w-40 bg-gray-100 rounded" />
            </div>
            {/* Edit + delete buttons */}
            <div className="flex shrink-0 gap-2">
              <div className="h-8 w-8 bg-gray-100 rounded-lg" />
              <div className="h-8 w-8 bg-gray-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
