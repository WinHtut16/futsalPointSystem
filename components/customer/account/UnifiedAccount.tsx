'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { Reward } from '@/types'
import AccountHeader from './AccountHeader'
import UnifiedTimeline, { type FeedItem } from './UnifiedTimeline'
import BookingHistoryCard from '@/components/booking/BookingHistoryCard'
import type { DashboardBooking } from '@/components/booking/BookingsDashboard'
import RewardsGrid from '@/components/customer/RewardsGrid'
import { useRealtimePoints } from '@/hooks/useRealtimePoints'

type Tab = 'upcoming' | 'history' | 'rewards'
type Filter = 'all' | 'bookings' | 'points'
type CursorMap = { all: string | null; bookings: string | null; points: string | null }

interface UnifiedAccountProps {
  name: string
  userId: string
  initialPoints: number
  initialUpdatedAt: string
  earned: number
  redeemed: number
  joinedISO: string
  phone?: string | null
  upcoming: DashboardBooking[]
  rewards: Reward[]
  initialPendingMap: Record<string, string>
  initialFeeds: { all: FeedItem[]; bookings: FeedItem[]; points: FeedItem[] }
  initialHasMore: { all: boolean; bookings: boolean; points: boolean }
}

export default function UnifiedAccount(props: UnifiedAccountProps) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const livePoints = useRealtimePoints(props.userId, props.initialPoints, props.initialUpdatedAt)
  const my = lang === 'my' ? 'my' : ''
  const [tab, setTab] = useState<Tab>('upcoming')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`customer-upcoming-${props.userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          try {
            if ((payload.new as { customer_id: string }).customer_id !== props.userId) return
            const newStatus = (payload.new as { status: string }).status
            if (newStatus === 'cancelled' || newStatus === 'confirmed') {
              router.refresh()
            }
          } catch (err) {
            console.error('[customer-upcoming] realtime handler error:', err)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [props.userId, router])

  // Per-filter feed state
  const [feeds, setFeeds] = useState(props.initialFeeds)
  const [hasMore, setHasMore] = useState(props.initialHasMore)
  const [cursors, setCursors] = useState<CursorMap>({ all: null, bookings: null, points: null })
  const [loading, setLoading] = useState(false)

  const tabs: { k: Tab; label: string }[] = [
    { k: 'upcoming', label: t('account.tab.upcoming') },
    { k: 'history', label: t('account.tab.history') },
    { k: 'rewards', label: t('account.tab.rewards') },
  ]

  function changeFilter(newFilter: Filter) {
    setFilter(newFilter)
  }

  const loadMore = useCallback(async () => {
    if (loading || !hasMore[filter]) return
    setLoading(true)
    const cursor = cursors[filter]
    const url = `/api/account/history?filter=${filter}${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`
    try {
      const res = await fetch(url)
      if (!res.ok) return
      const { items, hasMore: moreItems, nextCursor } = (await res.json()) as {
        items: FeedItem[]
        hasMore: boolean
        nextCursor: string | null
      }
      setFeeds((prev) => ({ ...prev, [filter]: [...prev[filter], ...items] }))
      setHasMore((prev) => ({ ...prev, [filter]: moreItems }))
      if (nextCursor) {
        setCursors((prev) => ({ ...prev, [filter]: nextCursor }))
      }
    } finally {
      setLoading(false)
    }
  }, [filter, hasMore, loading, cursors])

  const currentFeed = feeds[filter]

  return (
    <div>
      <AccountHeader
        name={props.name}
        userId={props.userId}
        points={livePoints}
        earned={props.earned}
        redeemed={props.redeemed}
        joinedISO={props.joinedISO}
        phone={props.phone}
      />

      {/* segmented tab bar */}
      <div className="mt-4 border-b border-line px-4">
        <div className="flex justify-between">
          {tabs.map((it) => {
            const on = it.k === tab
            return (
              <button
                key={it.k}
                type="button"
                onClick={() => setTab(it.k)}
                className={`-mb-px border-b-2 py-3 font-display text-[13px] ${my} ${
                  on ? 'border-primary font-bold text-ink-primary' : 'border-transparent font-semibold text-ink-muted'
                }`}
              >
                {it.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 pb-6 pt-[18px]">
        {/* ---------- UPCOMING ---------- */}
        {tab === 'upcoming' && (
          <div>
            <div className="mb-3.5 flex items-center justify-between">
              <div className={`font-display text-[15px] font-bold text-ink-primary ${my}`}>{t('account.upcoming')}</div>
              <Link href="/book" className="fb-btn fb-btn-primary !px-3.5 !py-2.5 !text-[12.5px]">
                <Plus size={13} strokeWidth={2.4} /> <span className={my}>{t('account.book')}</span>
              </Link>
            </div>
            {props.upcoming.length === 0 ? (
              <div className="fb-card p-8 text-center text-sm text-ink-muted">
                <span className={my}>{t('account.noUpcoming')}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {props.upcoming.map((b) => <BookingHistoryCard key={b.id} {...b} />)}
              </div>
            )}
          </div>
        )}

        {/* ---------- POINTS & REWARDS ---------- */}
        {tab === 'rewards' && (
          <div className="flex flex-col gap-[18px]">
            <div className="fb-card flex items-center gap-3.5 p-4">
              <div className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[var(--r-md)] bg-primary-soft text-primary">
                <Star size={22} strokeWidth={2} />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-extrabold tracking-tight text-ink-primary">{livePoints.toLocaleString('en-US')}</span>
                  <span className={`text-xs text-ink-muted ${my}`}>{t('account.pointsAvailable')}</span>
                </div>
              </div>
            </div>

            <div>
              <div className={`font-display text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint ${my}`}>{t('account.redeemKicker')}</div>
              <h2 className={`mb-3 mt-1 font-display text-[17px] font-bold text-ink-primary ${my}`}>{t('account.availableRewards')}</h2>
              <RewardsGrid
                rewards={props.rewards}
                userId={props.userId}
                userPoints={livePoints}
                initialPendingMap={props.initialPendingMap}
              />
            </div>
          </div>
        )}

        {/* ---------- HISTORY (unified feed) ---------- */}
        {tab === 'history' && (
          <div>
            <div className="mb-[18px] flex gap-2 overflow-x-auto">
              {([
                ['all', t('account.filterAll')],
                ['bookings', t('account.filterBookings')],
                ['points', t('account.filterPoints')],
              ] as [Filter, string][]).map(([k, label]) => {
                const on = k === filter
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => changeFilter(k)}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-display text-xs font-semibold ${my} ${
                      on ? 'bg-ink-primary text-white' : 'border border-line bg-surface text-ink-muted'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <UnifiedTimeline items={currentFeed} />

            {hasMore[filter] && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-display text-[13px] font-semibold text-ink-muted transition-colors hover:bg-black/5 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className={my}>{t('account.loadingMore')}</span>
                    </>
                  ) : (
                    <span className={my}>{t('account.loadMore')}</span>
                  )}
                </button>
              </div>
            )}

            {!hasMore[filter] && currentFeed.length > 0 && (
              <p className={`mt-5 text-center font-display text-[11px] text-ink-faint ${my}`}>
                {t('account.allLoaded')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
