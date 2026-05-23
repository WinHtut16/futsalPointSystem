export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Back link */}
      <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />

      {/* Staff info */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-44 bg-gray-100 rounded" />
      </div>

      {/* Reset password */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4 animate-pulse">
        <div className="h-5 w-36 bg-gray-200 rounded" />
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
        <div className="h-9 w-full bg-gray-200 rounded-xl" />
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3 animate-pulse">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-9 w-36 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}
