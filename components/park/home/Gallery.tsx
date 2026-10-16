'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { PHOTOS, type PhotoKey } from '@/lib/park/photos'
import ParkPhoto from '../ParkPhoto'

// Ordered morning to night, like the rest of the page. Widths vary so the
// strip reads as a contact sheet, not a row of identical cards.
const SLIDES: { photo: PhotoKey; width: string }[] = [
  { photo: 'galleryDeck', width: 'w-[78vw] sm:w-[420px]' },
  { photo: 'galleryLunch', width: 'w-[64vw] sm:w-[320px]' },
  { photo: 'galleryGarden', width: 'w-[84vw] sm:w-[520px]' },
  { photo: 'galleryDusk', width: 'w-[70vw] sm:w-[380px]' },
  { photo: 'galleryNight', width: 'w-[78vw] sm:w-[440px]' },
]

export default function Gallery() {
  const { t } = useLanguage()
  const track = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })

  const update = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  const step = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })
  }

  const btn =
    'flex h-12 w-12 items-center justify-center rounded-full border border-white/30 text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <section aria-labelledby="park-gallery" className="bg-park-night pb-24 text-[#eaf0f7] md:pb-28">
      <div className="mx-auto flex max-w-[1200px] items-end justify-between gap-4 px-4 md:px-8">
        <h2 id="park-gallery" className="park-display text-[34px] md:text-[42px]">
          {t('park.gallery.title')}
        </h2>
        <div className="flex gap-2.5">
          <button type="button" className={btn} onClick={() => step(-1)} disabled={edge.start} aria-label={t('park.gallery.prev')}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className={btn} onClick={() => step(1)} disabled={edge.end} aria-label={t('park.gallery.next')}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={track}
        onScroll={update}
        className="park-scroll-x mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 md:scroll-px-8 md:px-8 xl:px-[max(2rem,calc((100vw_-_1200px)/2_+_2rem))] xl:scroll-px-[max(2rem,calc((100vw_-_1200px)/2_+_2rem))]"
      >
        {SLIDES.map(({ photo, width }) => (
          <figure key={photo} className={`m-0 shrink-0 snap-start ${width}`}>
            <ParkPhoto photo={photo} sizes="(min-width: 640px) 520px, 84vw" className="aspect-[4/5] rounded-3xl" />
            <figcaption className="pt-3 text-sm text-[#a9b8cb]">{t(PHOTOS[photo].alt)}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
