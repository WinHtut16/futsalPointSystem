export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-72 bg-gray-100 rounded animate-pulse" />
      </div>

      <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />

      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-9 w-40 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
