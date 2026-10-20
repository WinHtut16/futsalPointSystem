'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { BoardStation, GameBoard, ShelfTitle } from '@/lib/park/game-board'
import { formatAmount } from '@/lib/park/time'
import CountUp from '../CountUp'

// The top of /games.
//   CoverWall: three rows of the shop's own game covers drift sideways behind
//     the neon title (alternating directions), pause when off screen and
//     speed up briefly while the visitor scrolls. Used once there are enough
//     covers to fill it (COVER_WALL_MIN); until then GamesContent keeps the
//     room photo hero.
//   LivePill: "6 of 10 free now" with a breathing green dot, from the live
//     board.
//   LiveStrip: per-console rate and free count under the hero.

export const COVER_WALL_MIN = 12

/** The client's ACJ Gaming lockup in brand mint, lit like the signs (scripts/acj-logos.py). */
export function AcjLogo({ className = '' }: { className?: string }) {
  return (
    <Image
      src="/images/acj/acj-horizontal-mint.png"
      alt="ACJ Gaming"
      width={1200}
      height={363}
      priority
      className={`acj-logo h-auto w-[200px] sm:w-[240px] ${className}`}
    />
  )
}

export function LivePill({ board }: { board: GameBoard | null }) {
  const { t, lang } = useLanguage()
  if (!board || board.stations.length === 0) return null
  const free = board.stations.filter((s) => s.status === 'free').length
  return (
    <a
      href="#games-floor"
      className="gh-pill inline-flex min-h-[40px] items-center gap-2.5 rounded-full px-4 text-[15px] font-semibold"
    >
      <span aria-hidden="true" className="arc-dot is-free arc-live" />
      <CountUp value={free}>
        {(v) => t('park.games.freeNow', { free: formatAmount(v, lang), total: formatAmount(board.stations.length, lang) })}
      </CountUp>
    </a>
  )
}

export function LiveStrip({
  board,
  price,
}: {
  board: GameBoard | null
  price: { ps4: number; ps5: number; vip: number }
}) {
  const { t, lang } = useLanguage()
  const n = (x: number) => formatAmount(x, lang)
  const tiers: { key: 'ps4' | 'ps5' | 'vip'; tier: BoardStation['tier']; label: string; tube: string }[] = [
    { key: 'ps4', tier: 'PS4', label: 'PS4', tube: 'tube-blue' },
    { key: 'ps5', tier: 'PS5', label: 'PS5', tube: 'tube-cyan' },
    { key: 'vip', tier: 'VIP', label: t('park.games.vip'), tube: 'tube-amber' },
  ]
  return (
    <div className="gh-strip relative">
      <ul className="mx-auto grid max-w-[1200px] gap-3 px-4 py-5 sm:grid-cols-3 md:px-8">
        {tiers.map(({ key, tier, label, tube }) => {
          const st = board?.stations.filter((s) => s.tier === tier) ?? []
          const free = st.filter((s) => s.status === 'free').length
          return (
            <li key={key}>
              <a href="#games-floor" className={`gh-chip ${tube} flex items-center justify-between gap-4 rounded-2xl px-4 py-3`}>
                <span className="flex items-baseline gap-3">
                  <span className="arc-num text-lg font-semibold">{label}</span>
                  <span className="arc-led font-semibold tabular-nums">
                    <CountUp value={price[key]} duration={1100}>
                      {(v) => t('park.venue.perHour', { price: n(Math.round(v / 100) * 100) })}
                    </CountUp>
                  </span>
                </span>
                {st.length > 0 && (
                  <span className="flex items-center gap-2 text-sm text-[rgb(var(--arc-muted))]">
                    <span aria-hidden="true" className={`arc-dot ${free ? 'is-free' : 'is-busy'}`} />
                    <CountUp value={free}>{(v) => t('park.games.stripFree', { free: n(v), total: n(st.length) })}</CountUp>
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CoverWall({
  covers,
  board,
}: {
  covers: ShelfTitle[]
  board: GameBoard | null
}) {
  const { t, lang } = useLanguage()
  const wall = useRef<HTMLDivElement>(null)

  // Pause off screen; speed up with scroll, then ease back to cruising.
  useEffect(() => {
    const el = wall.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const anims = () => el.getAnimations({ subtree: true })
    let boost = 0
    let lastY = window.scrollY
    let frame = 0
    const tick = () => {
      boost *= 0.9
      if (boost < 0.02) boost = 0
      for (const a of anims()) a.playbackRate = 1 + boost
      frame = boost ? requestAnimationFrame(tick) : 0
    }
    const onScroll = () => {
      const dy = Math.abs(window.scrollY - lastY)
      lastY = window.scrollY
      boost = Math.min(5, boost + dy / 60)
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(([e]) => {
      for (const a of anims()) {
        if (e.isIntersecting) a.play()
        else a.pause()
      }
    })
    io.observe(el)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  // Three rows from the same covers, each starting further along so no two
  // rows line up. Each row's list is doubled so the loop is seamless.
  const rows = [0, 1, 2].map((r) => {
    const shift = Math.floor((covers.length / 3) * r)
    return [...covers.slice(shift), ...covers.slice(0, shift)]
  })

  return (
    <section className="gh relative isolate overflow-hidden">
      <div ref={wall} aria-hidden="true" className="gh-wall">
        {rows.map((row, r) => (
          <div key={r} className={`gh-row ${r % 2 ? 'gh-row-rev' : ''}`} style={{ ['--dur' as string]: `${70 + r * 12}s` }}>
            {[...row, ...row].map((g, i) => (
              <span key={`${g.id}-${i}`} className="gh-tile">
                <Image src={g.coverUrl!} alt="" fill sizes="180px" className="object-cover" />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="gh-veil" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[min(88svh,760px)] max-w-[1200px] flex-col items-start justify-center gap-6 px-4 py-20 md:px-8">
        <AcjLogo />
        <LivePill board={board} />
        <h1
          className={`arc-font arc-sign tube-mint arc-flicker ${
            lang === 'my' ? 'text-[36px] sm:text-5xl' : 'max-w-[14ch] text-[46px] leading-[1.02] sm:text-6xl lg:text-[76px]'
          }`}
        >
          {t('park.games.title')}
        </h1>
        <p className="max-w-[40ch] text-lg leading-relaxed text-[rgb(var(--arc-text)/0.85)]">{t('park.games.lead')}</p>
        <div className="flex flex-wrap gap-3">
          <a href="#games-library" className="arc-btn-primary inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold">
            {t('park.games.ctaBrowse')}
          </a>
          <a href="#games-floor" className="arc-btn-ghost inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold">
            {t('park.games.ctaFree')}
          </a>
        </div>
      </div>
    </section>
  )
}
