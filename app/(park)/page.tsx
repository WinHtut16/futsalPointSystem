import T from '@/components/ui/T'

// Phase 1 shell. The full "A day at MyaThida" landing lands in Phase 2.
export default function ParkHomePage() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-20 md:px-8 md:py-28">
      <h1 className="park-display max-w-[14ch] text-5xl leading-[1.04] text-park-jungle md:text-7xl">
        <T k="park.home.title" />
      </h1>
      <p className="mt-6 text-lg text-park-ink-soft">
        <T k="park.shell.building" />
      </p>
    </section>
  )
}
