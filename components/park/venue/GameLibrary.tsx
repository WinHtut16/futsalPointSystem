'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import type { ShelfTitle } from '@/lib/park/game-board'
import { buildRows, descriptionFor, filterTitles, pickFeatured, type LibraryFilter } from '@/lib/park/game-library'
import { formatAmount } from '@/lib/park/time'
import ViberLink from '../ViberLink'
import GameCard, { Cover, tubeFor } from './GameCard'
import GameDetail from './GameDetail'

// The /games library, built from the staff's list on the game admin's Games
// screen (game.titles):
//   - Featured: one game at a time, big; arrows, swipe or the thumbnails move
//     it (no auto-rotation: the visitor decides when it changes);
//   - category rows that scroll sideways (lib/park/game-library.ts decides
//     which rows exist);
//   - "All games": the whole list with search and console / co-op filters;
//   - any game opens the detail sheet (GameDetail).
// An empty list shows a teaser instead of a blank section.

const h2 = 'arc-font arc-sign-soft tube-magenta text-[36px] leading-[1.1] md:text-[46px]'
const arrowBtn =
  'flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-[rgb(var(--arc-text))] transition-colors hover:border-[rgb(var(--arc-cyan))] hover:bg-white/5 disabled:opacity-30'

export default function GameLibrary({ titles }: { titles: ShelfTitle[] }) {
  const { t, lang } = useLanguage()
  const n = (x: number) => formatAmount(x, lang)
  const [open, setOpen] = useState<ShelfTitle | null>(null)

  const rows = useMemo(() => buildRows(titles), [titles])
  const featured = useMemo(() => pickFeatured(titles), [titles])

  // Open with the cover growing out of the card where the browser can.
  const openGame = useCallback((g: ShelfTitle, from: HTMLElement | null) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!doc.startViewTransition || !from || reduce) {
      setOpen(g)
      return
    }
    from.style.viewTransitionName = 'game-cover'
    doc.startViewTransition(() => {
      from.style.viewTransitionName = ''
      flushSync(() => setOpen(g))
    })
  }, [])

  if (titles.length === 0) return <Teaser />

  return (
    <section aria-labelledby="games-library" className="py-20 md:py-24">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex max-w-[52ch] flex-col gap-3">
            <h2 id="games-library" className={`${h2} scroll-mt-32`}>
              {t('park.games.shelfTitle')}
            </h2>
            <p className="text-[17px] leading-relaxed text-[rgb(var(--arc-muted))]">{t('park.games.shelfBody')}</p>
          </div>
          <p className="arc-led text-lg font-semibold">{t('park.lib.count', { n: n(titles.length) })}</p>
        </header>

        {featured.length > 0 && <Featured games={featured} onOpen={openGame} />}

        {rows.map((row) => (
          <Row key={row.key} title={t(`park.lib.rows.${row.key}` as TranslationKey)} games={row.titles} onOpen={openGame} />
        ))}

        <AllGames titles={titles} onOpen={openGame} />
      </div>

      <GameDetail game={open} onClose={() => setOpen(null)} />
    </section>
  )
}

// ── Featured ────────────────────────────────────────────────────────────────
function Featured({ games, onOpen }: { games: ShelfTitle[]; onOpen: (g: ShelfTitle, from: HTMLElement | null) => void }) {
  const { t, lang } = useLanguage()
  const [i, setI] = useState(0)
  const swipe = useRef<number | null>(null)
  const cover = useRef<HTMLSpanElement>(null)
  const g = games[i]
  const count = games.length
  const go = (d: 1 | -1) => setI((x) => (x + d + count) % count)
  const desc = descriptionFor(g, lang)
  const n = (x: number) => formatAmount(x, lang)

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={t('park.lib.featured')}
      className={`gl-feature ${tubeFor(g)} relative overflow-hidden rounded-[28px]`}
      onPointerDown={(e) => {
        swipe.current = e.clientX
      }}
      onPointerUp={(e) => {
        if (swipe.current === null) return
        const dx = e.clientX - swipe.current
        swipe.current = null
        if (Math.abs(dx) > 50 && count > 1) go(dx < 0 ? 1 : -1)
      }}
    >
      {/* The cover again, blurred and dimmed: the game's own light fills the panel. */}
      {g.coverUrl && (
        <span key={`bg-${g.id}`} aria-hidden="true" className="gl-feature-bg">
          <Image src={g.coverUrl} alt="" fill sizes="600px" className="object-cover" />
        </span>
      )}
      <div key={g.id} className="gl-feature-body relative grid items-center gap-6 p-5 sm:grid-cols-[minmax(0,260px)_1fr] sm:gap-10 sm:p-8 lg:p-10">
        <button
          type="button"
          onClick={() => onOpen(g, cover.current)}
          className="gl-card mx-auto w-[min(62vw,260px)] sm:w-full"
          aria-label={t('park.lib.open', { title: g.title })}
        >
          <span ref={cover} className="gl-box relative block aspect-[3/4] overflow-hidden rounded-2xl">
            <Cover game={g} sizes="(min-width: 640px) 260px, 62vw" className="absolute inset-0" />
          </span>
        </button>
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[rgb(var(--arc-amber))]">
            {t('park.lib.featured')} · <span aria-live="polite">{n(i + 1)} / {n(count)}</span>
          </p>
          <h3 className="arc-num arc-sign text-[clamp(30px,4.6vw,52px)] leading-[1.05]">{g.title}</h3>
          <ul className="flex flex-wrap gap-2 text-[13px] font-semibold">
            {g.platforms.map((p) => (
              <li key={p} className={`arc-tag ${p === 'PS5' ? 'tube-cyan' : 'tube-blue'}`}>
                {p}
              </li>
            ))}
            <li className="arc-tag tube-magenta">
              {g.maxPlayers === 1 ? t('park.games.player1') : t('park.games.playersN', { n: n(g.maxPlayers) })}
            </li>
            {g.localCoop && <li className="arc-tag tube-amber">{t('park.lib.coop')}</li>}
            {g.online && <li className="arc-tag tube-blue">{t('park.lib.online')}</li>}
          </ul>
          {desc && <p className="max-w-[52ch] text-[17px] leading-relaxed text-[rgb(var(--arc-text)/0.85)]">{desc}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onOpen(g, cover.current)}
              className="arc-btn-primary inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold"
            >
              {t('park.lib.details')}
            </button>
            <ViberLink className="arc-btn-ghost inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold">
              {t('park.lib.ask')}
            </ViberLink>
          </div>
        </div>
      </div>

      {count > 1 && (
        <div className="relative flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 sm:px-8">
          <ul className="flex min-w-0 gap-2 overflow-x-auto park-scroll-x">
            {games.map((x, k) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setI(k)}
                  aria-label={t('park.lib.show', { title: x.title })}
                  aria-current={k === i}
                  className={`gl-thumb ${tubeFor(x)} relative block h-[60px] w-[45px] overflow-hidden rounded-md`}
                >
                  <Cover game={x} sizes="45px" className="absolute inset-0" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex shrink-0 gap-2">
            <button type="button" className={arrowBtn} onClick={() => go(-1)} aria-label={t('park.lib.prev')}>
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button type="button" className={arrowBtn} onClick={() => go(1)} aria-label={t('park.lib.next')}>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Category row ────────────────────────────────────────────────────────────
function Row({
  title,
  games,
  onOpen,
}: {
  title: string
  games: ShelfTitle[]
  onOpen: (g: ShelfTitle, from: HTMLElement | null) => void
}) {
  const { t } = useLanguage()
  const track = useRef<HTMLUListElement>(null)
  // Arrows only do something when there is more of the row to see.
  const [edge, setEdge] = useState({ start: true, end: true })
  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }, [])
  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (track.current) ro.observe(track.current)
    return () => ro.disconnect()
  }, [measure])
  const scroll = (d: 1 | -1) => {
    const el = track.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' })
  }
  return (
    <div className="gl-row flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h3 className="arc-font text-[24px] leading-tight md:text-[28px]">{title}</h3>
        <div className="hidden gap-2 sm:flex">
          <button type="button" className={arrowBtn} onClick={() => scroll(-1)} disabled={edge.start} aria-label={t('park.lib.scrollPrev', { row: title })}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className={arrowBtn} onClick={() => scroll(1)} disabled={edge.end} aria-label={t('park.lib.scrollNext', { row: title })}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul
        ref={track}
        onScroll={measure}
        className="park-scroll-x -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 pt-1 md:-mx-8 md:scroll-px-8 md:px-8"
      >
        {games.map((g, k) => (
          <li key={g.id} className="gl-row-item w-[42vw] max-w-[190px] shrink-0 snap-start" style={{ ['--i' as string]: k }}>
            <GameCard game={g} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── All games ───────────────────────────────────────────────────────────────
function AllGames({ titles, onOpen }: { titles: ShelfTitle[]; onOpen: (g: ShelfTitle, from: HTMLElement | null) => void }) {
  const { t, lang } = useLanguage()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const shown = useMemo(() => filterTitles(titles, query, filter), [titles, query, filter])
  const filters: { key: LibraryFilter; label: string }[] = [
    { key: 'all', label: t('park.games.shelfAll') },
    { key: 'PS5', label: 'PS5' },
    { key: 'PS4', label: 'PS4' },
    { key: 'coop', label: t('park.lib.coop') },
  ]
  return (
    <div className="flex flex-col gap-6 border-t border-white/10 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h3 className="arc-font text-[24px] leading-tight md:text-[28px]">
          {t('park.lib.all', { n: formatAmount(titles.length, lang) })}
        </h3>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <label className="gl-search relative flex min-h-[44px] flex-1 items-center sm:w-[260px] sm:flex-none">
            <Search size={17} aria-hidden="true" className="absolute left-4 text-[rgb(var(--arc-muted))]" />
            <span className="sr-only">{t('park.lib.search')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('park.lib.search')}
              className="h-full min-h-[44px] w-full rounded-full bg-transparent pl-11 pr-4 text-[15px] outline-none"
            />
          </label>
          <div role="group" aria-label={t('park.games.shelfFilter')} className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className="arc-chip min-h-[44px] rounded-full px-4 text-[14px] font-semibold"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {t('park.lib.results', { n: formatAmount(shown.length, lang) })}
      </p>
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((g) => (
            <li key={g.id}>
              <GameCard game={g} onOpen={onOpen} sizes="(min-width: 1024px) 170px, (min-width: 640px) 30vw, 46vw" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[16px] text-[rgb(var(--arc-muted))]">{t('park.lib.noMatch')}</p>
      )}
    </div>
  )
}

// ── Empty list ──────────────────────────────────────────────────────────────
function Teaser() {
  const { t } = useLanguage()
  return (
    <section aria-labelledby="games-library" className="py-20 md:py-24">
      <div className="mx-auto max-w-[1200px] px-4 md:px-8">
        <div className="gl-teaser relative flex flex-col items-start gap-5 overflow-hidden rounded-[28px] p-8 md:p-12">
          <h2 id="games-library" className="scroll-mt-32 arc-font arc-sign tube-magenta arc-flicker text-[36px] leading-[1.1] md:text-[46px]">
            {t('park.lib.teaserTitle')}
          </h2>
          <p className="max-w-[48ch] text-[17px] leading-relaxed text-[rgb(var(--arc-muted))]">{t('park.lib.teaserBody')}</p>
          <ViberLink className="arc-btn-ghost inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold">
            {t('park.lib.teaserCta')}
          </ViberLink>
        </div>
      </div>
    </section>
  )
}
