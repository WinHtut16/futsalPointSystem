'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LogOut, Settings } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useRealtimePoints } from '@/hooks/useRealtimePoints'
import RewardsGrid from '@/components/customer/RewardsGrid'
import UnifiedTimeline, { type FeedItem } from '@/components/customer/account/UnifiedTimeline'
import { VENUE_PAGE, VENUE_PORTAL, formatMinutes, type Venue, type VenueSession } from '@/lib/venue-account'
import { formatDate } from '@/lib/utils'
import type { Reward } from '@/types'

export type VenueTab = 'rewards' | 'history' | 'sessions'

// The venue's own colours for the header band; the working area stays on the
// light customer surface so the shared rewards and history pieces read the same
// as on futsal's /account.
const HEADER: Record<Venue, { band: string; accent: string; muted: string; chip: string }> = {
  game: {
    band: 'bg-[rgb(9,8,22)] text-[rgb(238,240,255)]',
    accent: 'text-venue-amber',
    muted: 'text-[rgb(184,190,226)]',
    chip: 'border-white/20 hover:bg-white/10',
  },
  billiards: {
    band: 'bg-[#1f1214] text-[#f6ece6]',
    accent: 'text-venue-brass',
    muted: 'text-[#e2ccd2]',
    chip: 'border-white/20 hover:bg-white/10',
  },
}

type Page<T> = { items: T[]; hasMore: boolean }

interface Props {
  venue: Venue
  name: string
  userId: string
  initialPoints: number
  earned: number
  redeemed: number
  rewards: Reward[]
  initialPendingMap: Record<string, string>
  initialHistory: Page<FeedItem>
  initialSessions: Page<VenueSession>
  initialTab: VenueTab
}

export default function VenueAccount(props: Props) {
  const { venue } = props
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const router = useRouter()
  const h = HEADER[venue]
  const portal = VENUE_PORTAL[venue]

  const points = useRealtimePoints(props.userId, props.initialPoints, venue)
  const [tab, setTab] = useState<VenueTab>(props.initialTab)

  const [history, setHistory] = useState(props.initialHistory)
  const [sessions, setSessions] = useState(props.initialSessions)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const loadMoreHistory = useCallback(async () => {
    if (loading || !history.hasMore) return
    const last = history.items[history.items.length - 1]
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch(
        `/api/account/history?filter=points&app=${venue}${last ? `&before=${encodeURIComponent(last.ts)}` : ''}`
      )
      if (!res.ok) throw new Error()
      const data = (await res.json()) as Page<FeedItem>
      setHistory((prev) => ({ items: [...prev.items, ...data.items], hasMore: data.hasMore }))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [loading, history, venue])

  const loadMoreSessions = useCallback(async () => {
    if (loading || !sessions.hasMore) return
    const last = sessions.items[sessions.items.length - 1]
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch(
        `/api/account/sessions?app=${venue}${last ? `&before=${encodeURIComponent(last.played_at)}` : ''}`
      )
      if (!res.ok) throw new Error()
      const data = (await res.json()) as Page<VenueSession>
      setSessions((prev) => ({ items: [...prev.items, ...data.items], hasMore: data.hasMore }))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [loading, sessions, venue])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push(VENUE_PAGE[venue])
    router.refresh()
  }

  function switchTab(next: VenueTab) {
    setTab(next)
    setLoadError(false)
    // Keep the tab in the address so a refresh or shared link opens it.
    window.history.replaceState(null, '', next === 'rewards' ? portal : `${portal}?tab=${next}`)
  }

  const tabs: { id: VenueTab; label: string }[] = [
    { id: 'rewards', label: t('venue.tab.rewards') },
    { id: 'history', label: t('venue.tab.history') },
    { id: 'sessions', label: t('venue.tab.sessions') },
  ]

  return (
    <div>
      {/* Header band in the venue's colours */}
      <section className={`${h.band} px-4 pb-8 pt-6 md:px-8`}>
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={VENUE_PAGE[venue]}
              aria-label={t('venue.portal.back')}
              className={`flex h-10 w-10 items-center justify-center rounded-full border ${h.chip}`}
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/account/settings?back=${encodeURIComponent(portal)}`}
                aria-label={t('venue.portal.settings')}
                title={t('venue.portal.settings')}
                className={`flex h-10 w-10 items-center justify-center rounded-full border ${h.chip}`}
              >
                <Settings size={18} />
              </Link>
              <button
                type="button"
                onClick={logout}
                aria-label={t('venue.portal.logout')}
                title={t('venue.portal.logout')}
                className={`flex h-10 w-10 items-center justify-center rounded-full border ${h.chip}`}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <div>
            <p className={`text-sm font-semibold ${h.accent} ${my}`}>
              {t(venue === 'game' ? 'venue.portal.game' : 'venue.portal.billiards')}
            </p>
            <h1 className={`park-display mt-1 text-[28px] leading-tight md:text-[34px] ${my}`}>{props.name}</h1>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={`text-sm ${h.muted} ${my}`}>{t('venue.portal.balance')}</p>
              <p className={`park-display text-[48px] leading-none ${h.accent}`} aria-live="polite">
                {points.toLocaleString('en-US')}
              </p>
            </div>
            <dl className="flex gap-6 text-sm">
              <div>
                <dt className={`${h.muted} ${my}`}>{t('account.earned')}</dt>
                <dd className="text-lg font-bold">{props.earned.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt className={`${h.muted} ${my}`}>{t('account.redeemed')}</dt>
                <dd className="text-lg font-bold">{props.redeemed.toLocaleString('en-US')}</dd>
              </div>
            </dl>
          </div>

          <p className={`text-[13px] leading-relaxed ${h.muted} ${my}`}>
            {t(venue === 'game' ? 'venue.portal.earnGame' : 'venue.portal.earnBilliards')}{' '}
            {t('venue.portal.separateNote')}
          </p>
        </div>
      </section>

      {/* Working area */}
      <div className="bg-[var(--color-background)] px-4 pb-10 pt-5 md:px-8">
        <div className="mx-auto max-w-2xl">
          <div role="tablist" className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-black/5 p-1">
            {tabs.map((x) => (
              <button
                key={x.id}
                role="tab"
                type="button"
                aria-selected={tab === x.id}
                onClick={() => switchTab(x.id)}
                className={`min-h-[40px] rounded-lg px-2 text-sm font-semibold transition-colors ${my} ${
                  tab === x.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>

          {tab === 'rewards' && (
            <RewardsGrid
              rewards={props.rewards}
              userId={props.userId}
              userPoints={points}
              initialPendingMap={props.initialPendingMap}
              app={venue}
              emptyHref={VENUE_PAGE[venue]}
              rewardsHref={portal}
            />
          )}

          {tab === 'history' && (
            <>
              <UnifiedTimeline items={history.items} />
              <LoadMore hasMore={history.hasMore} loading={loading} error={loadError} onClick={loadMoreHistory} />
            </>
          )}

          {tab === 'sessions' && (
            <>
              <SessionList venue={venue} items={sessions.items} />
              <LoadMore hasMore={sessions.hasMore} loading={loading} error={loadError} onClick={loadMoreSessions} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadMore({
  hasMore,
  loading,
  error,
  onClick,
}: {
  hasMore: boolean
  loading: boolean
  error: boolean
  onClick: () => void
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  if (!hasMore) return null
  return (
    <div className="mt-5 flex flex-col items-center gap-2">
      {error && <p className={`text-sm text-red-600 ${my}`}>{t('venue.loadError')}</p>}
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className={`fb-btn-ghost min-h-[40px] rounded-xl border border-gray-200 px-4 text-sm font-semibold ${my}`}
      >
        {loading ? t('account.loadingMore') : t('account.loadMore')}
      </button>
    </div>
  )
}

function SessionList({ venue, items }: { venue: Venue; items: VenueSession[] }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  if (items.length === 0) {
    return (
      <div className="fb-card p-8 text-center text-sm text-ink-muted">
        <span className={my}>{t('venue.sessions.empty')}</span>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((s) => (
        <li
          key={s.id}
          className="fb-card flex items-center justify-between gap-3 px-4 py-3"
          style={{ opacity: s.voided ? 0.65 : 1 }}
        >
          <div className="min-w-0">
            <p className={`font-display text-[14px] font-bold text-ink-primary ${my}`}>
              {s.place ?? t(venue === 'game' ? 'venue.sessions.place' : 'venue.sessions.table')}
              {' · '}
              {t('venue.sessions.paid', { time: formatMinutes(s.paid_minutes) })}
            </p>
            <p className="mt-0.5 font-fbmono text-[11px] text-ink-muted">{formatDate(s.played_at, lang)}</p>
          </div>
          {s.voided ? (
            <span className={`fb-chip pill-booked flex-shrink-0 px-2.5 py-1 text-xs ${my}`}>
              {t('venue.sessions.voided')}
            </span>
          ) : (
            <span
              className={`flex-shrink-0 font-display text-[14px] font-extrabold ${my}`}
              style={{ color: s.points > 0 ? 'var(--color-slot-available)' : 'var(--color-text-muted)' }}
            >
              {s.points > 0 ? t('venue.sessions.points', { n: s.points }) : t('venue.sessions.noPoints')}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
