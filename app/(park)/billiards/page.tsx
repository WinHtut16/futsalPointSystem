import type { Metadata } from 'next'
import T from '@/components/ui/T'

export const metadata: Metadata = {
  title: 'Billiards',
  description: 'Three pool tables, snacks and cold drinks at MyaThida Park.',
}

// Phase 1 shell. Full page lands in Phase 3.
export default function BilliardsPage() {
  return (
    <section className="bg-park-night text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-20 md:px-8 md:py-28">
        <h1 className="park-display max-w-[16ch] text-5xl leading-[1.04] md:text-7xl">
          <T k="park.billiards.title" />
        </h1>
        <p className="mt-6 text-lg text-white/75">
          <T k="park.shell.building" />
        </p>
      </div>
    </section>
  )
}
