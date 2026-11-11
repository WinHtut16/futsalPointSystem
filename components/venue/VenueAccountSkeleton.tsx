import type { Venue } from '@/lib/venue-account'

const BAND: Record<Venue, string> = {
  game: 'bg-[rgb(9,8,22)]',
  billiards: 'bg-[#1f1214]',
}

/** Loading shape of the venue points portal: header band, tabs, three cards. */
export default function VenueAccountSkeleton({ venue }: { venue: Venue }) {
  return (
    <div className="animate-pulse" aria-busy="true">
      <section className={`${BAND[venue]} px-4 pb-8 pt-6 md:px-8`}>
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div className="flex justify-between">
            <div className="h-10 w-10 rounded-full bg-white/10" />
            <div className="flex gap-2">
              <div className="h-10 w-10 rounded-full bg-white/10" />
              <div className="h-10 w-10 rounded-full bg-white/10" />
            </div>
          </div>
          <div className="h-4 w-32 rounded-full bg-white/15" />
          <div className="h-8 w-48 rounded-full bg-white/15" />
          <div className="h-12 w-28 rounded-xl bg-white/15" />
          <div className="h-3 w-full rounded-full bg-white/10" />
        </div>
      </section>
      <div className="px-4 pb-10 pt-5 md:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 h-12 rounded-xl bg-gray-100" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
