import SiteNavbar from '@/components/booking/SiteNavbar'
import BottomNav from '@/components/booking/BottomNav'

export default function HomeLoading() {
  return (
    <>
      <SiteNavbar active="home" />
      <div className="animate-pulse">
        {/* Hero */}
        <div className="relative h-[460px] bg-surface-alt md:h-[520px]">
          <div className="absolute bottom-5 left-5 space-y-2.5 md:bottom-16 md:left-16">
            <div className="h-2.5 w-28 rounded-full bg-surface" />
            <div className="h-8 w-64 rounded-[var(--r-md)] bg-surface md:h-12 md:w-96" />
            <div className="h-2.5 w-48 rounded-full bg-surface" />
            <div className="mt-2 h-11 w-36 rounded-[var(--r-md)] bg-surface" />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-5 md:px-16">
          {/* Features */}
          <div className="mt-6 grid grid-cols-2 gap-2.5 md:mt-16 md:grid-cols-4 md:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-[var(--r-lg)] bg-surface-alt md:h-36" />
            ))}
          </div>

          {/* How it works + pricing */}
          <div className="mt-7 md:mt-16 md:grid md:grid-cols-2 md:gap-8">
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-[var(--r-lg)] bg-surface-alt" />
              ))}
            </div>
            <div className="mt-7 h-44 rounded-[var(--r-lg)] bg-surface-alt md:mt-0" />
          </div>

          {/* News */}
          <div className="mt-7 grid grid-cols-1 gap-3 md:mt-16 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 rounded-[var(--r-lg)] bg-surface-alt" />
            ))}
          </div>
        </div>
      </div>

      <BottomNav active="home" />
    </>
  )
}
