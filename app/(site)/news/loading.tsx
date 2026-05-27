import SiteNavbar from '@/components/booking/SiteNavbar'
import BottomNav from '@/components/booking/BottomNav'

export default function NewsLoading() {
  return (
    <>
      <SiteNavbar active="news" />
      <div className="mx-auto max-w-6xl animate-pulse px-4 pb-24 pt-5 md:px-16 md:pt-10">
        {/* Section label — desktop only */}
        <div className="mb-5 hidden space-y-2 md:block">
          <div className="h-2.5 w-16 rounded-full bg-surface-alt" />
          <div className="h-6 w-48 rounded-[var(--r-md)] bg-surface-alt" />
        </div>

        {/* Filter pills */}
        <div className="mb-4 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-16 flex-shrink-0 rounded-full bg-surface-alt" />
          ))}
        </div>

        {/* News cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-[var(--r-lg)] bg-surface-alt" />
          ))}
        </div>
      </div>

      <BottomNav active="news" />
    </>
  )
}
