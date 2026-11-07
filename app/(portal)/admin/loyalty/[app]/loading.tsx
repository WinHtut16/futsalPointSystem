/**
 * Shown while a loyalty tab loads. The layout (header, title, tabs) stays on
 * screen; this only stands in for the tab's content - cards, neutral grays,
 * same as the futsal admin skeletons.
 */
export default function LoyaltyLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
