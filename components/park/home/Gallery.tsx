'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { flushSync } from 'react-dom'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { PHOTOS, type PhotoKey } from '@/lib/park/photos'
import GalleryViewer from './GalleryViewer'

// "Around the park": a pile of printed snapshots on the night table.
//
// Desktop (wide and tall enough, motion allowed): the section pins under the
// nav and scrolling deals the pile out into a loose collage, each print a
// little behind the one before. Phones and reduced motion: no pinning, a
// two-column scatter of prints that drop in as they arrive (still, for
// reduced motion). Either way a print opens the full-screen viewer.
//
// Positions are plain numbers set as CSS variables (--px/--py/--pr for the
// pile, --sx/--sy/--sr for the spread, --k for progress); park.css (.gp-*)
// mixes them, so a scroll costs one variable write per print.

export type GalleryShot = { photo: PhotoKey; portrait: boolean }

// Morning to night, like the rest of the page.
export const SHOTS: GalleryShot[] = [
  { photo: 'galleryPoolWater', portrait: false },
  { photo: 'galleryPoolLadder', portrait: true },
  { photo: 'galleryGreens', portrait: true },
  { photo: 'galleryFutsal', portrait: true },
  { photo: 'galleryEveningWalk', portrait: true },
  { photo: 'gallerySunsetStatue', portrait: false },
  { photo: 'galleryPath', portrait: true },
  { photo: 'galleryPlaza', portrait: true },
  { photo: 'galleryFutsalNight', portrait: false },
  { photo: 'galleryLaneBlueHour', portrait: true },
  { photo: 'galleryMarket', portrait: true },
]

const NAV_H = 72 // park header height at lg (ParkNav)
const COLS = 4

// Same "random" mess on every load.
const jitter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x) - 0.5 // -0.5..0.5
}
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

export default function Gallery() {
  const { t } = useLanguage()
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLButtonElement | null)[]>([])
  // 'grid' until script decides; the server and no-JS render the scatter.
  const [mode, setMode] = useState<'grid' | 'scene'>('grid')
  const [open, setOpen] = useState<number | null>(null)

  // Pick the mode: the dealt-out scene needs room and motion.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)')
    const sync = () => setMode(mq.matches ? 'scene' : 'grid')
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Scene: lay out pile and spread, then follow scroll.
  useEffect(() => {
    if (mode !== 'scene') return
    const sec = section.current
    const st = stage.current
    if (!sec || !st) return

    const layout = () => {
      const W = st.clientWidth
      const H = st.clientHeight
      const rows = Math.ceil(SHOTS.length / COLS)
      const cw = W / COLS
      const ch = H / rows
      // u: a portrait print is 0.8u x u, a landscape one 1.2u x 0.9u.
      const u = Math.min(cw / 1.3, ch / 1.08) * 0.94
      SHOTS.forEach((s, i) => {
        const el = cards.current[i]
        if (!el) return
        const w = s.portrait ? 0.8 * u : 1.2 * u
        const h = s.portrait ? u : 0.9 * u
        const col = i % COLS
        const row = Math.floor(i / COLS)
        // A short last row sits centred rather than hugging the left.
        const inRow = Math.min(COLS, SHOTS.length - row * COLS)
        const rowShift = ((COLS - inRow) * cw) / 2
        el.style.width = `${w}px`
        el.style.height = `${h}px`
        el.style.setProperty('--px', `${jitter(i, 1) * 70}px`)
        el.style.setProperty('--py', `${jitter(i, 2) * 40}px`)
        el.style.setProperty('--pr', `${jitter(i, 3) * 22}deg`)
        el.style.setProperty('--sx', `${(col + 0.5) * cw + rowShift - W / 2 + jitter(i, 4) * cw * 0.22}px`)
        el.style.setProperty('--sy', `${(row + 0.5) * ch - H / 2 + jitter(i, 5) * ch * 0.14}px`)
        el.style.setProperty('--sr', `${jitter(i, 6) * 12}deg`)
      })
    }

    const update = () => {
      const r = sec.getBoundingClientRect()
      const travel = sec.offsetHeight - (window.innerHeight - NAV_H)
      const p = Math.min(1, Math.max(0, (NAV_H - r.top) / Math.max(1, travel)))
      SHOTS.forEach((_, i) => {
        const el = cards.current[i]
        if (!el) return
        // Prints leave the pile one after another; all down by 75% of the way.
        const start = (i / SHOTS.length) * 0.3
        const k = ease(Math.min(1, Math.max(0, (p - start) / 0.45)))
        el.style.setProperty('--k', k.toFixed(4))
      })
    }

    layout()
    update()
    const ro = new ResizeObserver(() => {
      layout()
      update()
    })
    ro.observe(st)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update)
    }
  }, [mode])

  // Grid: prints drop in as they arrive (motion allowed only).
  useEffect(() => {
    if (mode !== 'grid') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-seen')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.25 },
    )
    cards.current.forEach((el) => {
      if (!el) return
      if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
        el.classList.add('is-armed')
        io.observe(el)
      }
    })
    return () => io.disconnect()
  }, [mode])

  // Open with the print zooming into the viewer where the browser can.
  const openAt = useCallback((i: number) => {
    const img = cards.current[i]?.querySelector('img')
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!doc.startViewTransition || !img || reduce) {
      setOpen(i)
      return
    }
    img.style.viewTransitionName = 'gallery-photo'
    doc.startViewTransition(() => {
      img.style.viewTransitionName = ''
      flushSync(() => setOpen(i))
    })
  }, [])

  const scene = mode === 'scene'

  return (
    <section
      ref={section}
      aria-labelledby="park-gallery"
      className={`bg-park-night text-[#eaf0f7] ${scene ? 'gp-scene' : 'pb-24 md:pb-28'}`}
    >
      <div className={scene ? 'gp-sticky' : ''}>
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-end justify-between gap-x-6 gap-y-2 px-4 md:px-8">
          <h2 id="park-gallery" className="park-display text-[34px] md:text-[42px]">
            {t('park.gallery.title')}
          </h2>
          <p className="text-sm text-[#a9b8cb]">{t('park.gallery.hint')}</p>
        </div>

        <div
          ref={stage}
          className={
            scene
              ? 'gp-stage relative mx-auto mt-6 max-w-[1200px] px-8'
              : 'mx-auto mt-8 grid max-w-[1200px] grid-cols-2 gap-x-4 gap-y-6 px-4 sm:grid-cols-3 md:px-8'
          }
        >
          {SHOTS.map((s, i) => {
            const p = PHOTOS[s.photo]
            return (
              <button
                key={s.photo}
                ref={(el) => {
                  cards.current[i] = el
                }}
                type="button"
                onClick={() => openAt(i)}
                aria-label={t('park.gallery.open', { caption: t(p.alt) })}
                className={`gp-print ${scene ? 'gp-print-scene' : 'gp-print-grid'} ${
                  !scene && i % 2 === 1 ? 'mt-8' : ''
                } ${!scene ? (s.portrait ? 'aspect-[4/5]' : 'aspect-[4/3] self-start') : ''}`}
                style={{
                  zIndex: scene ? SHOTS.length - i : undefined,
                  ['--gr' as string]: `${jitter(i, 7) * 6}deg`,
                }}
              >
                <span className="relative block h-full w-full overflow-hidden">
                  <Image src={p.file} alt="" fill sizes="(min-width: 1024px) 320px, 46vw" className="object-cover" />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <GalleryViewer shots={SHOTS} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
    </section>
  )
}
