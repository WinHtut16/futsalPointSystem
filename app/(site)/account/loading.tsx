import SiteNavbar from '@/components/booking/SiteNavbar'

export default function AccountLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar active="account" />
      <div className="mx-auto w-full max-w-2xl flex-1 animate-pulse pb-8">
        {/* Identity row */}
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 rounded-full bg-gray-200" />
              <div className="h-3 w-28 rounded-full bg-gray-100" />
            </div>
            <div className="h-8 w-8 rounded-full bg-gray-100" />
          </div>

          {/* Points card */}
          <div className="mt-3.5 h-[110px] rounded-[var(--r-lg)] bg-gray-200" />

          {/* Sign-out button */}
          <div className="mt-3 h-10 rounded-[var(--r-md)] bg-gray-100" />
        </div>

        {/* Tab bar */}
        <div className="mt-4 border-b border-gray-100 px-4">
          <div className="flex gap-8 pb-px">
            {[0, 1, 2].map((i) => (
              <div key={i} className="my-3 h-3.5 w-16 rounded-full bg-gray-200" />
            ))}
          </div>
        </div>

        {/* Content cards */}
        <div className="space-y-3 px-4 pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  )
}