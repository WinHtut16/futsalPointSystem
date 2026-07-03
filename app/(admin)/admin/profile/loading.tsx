export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Heading */}
      <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />

      {/* Card 1 — Profile Information */}
      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4 animate-pulse">
        <div className="h-3.5 w-36 bg-gray-200 rounded" />
        <div className="h-10 w-full bg-gray-100 rounded-xl" />
        <div className="flex justify-end">
          <div className="h-10 w-32 bg-gray-200 rounded-xl" />
        </div>
      </div>

      {/* Card 2 — Change Password */}
      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4 animate-pulse">
        <div className="h-3.5 w-40 bg-gray-200 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="relative">
              <div className="h-10 w-full bg-gray-100 rounded-xl" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <div className="h-10 w-40 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  )
}