'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Star, Zap } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { Reward } from '@/types'
import AccountHeader from './AccountHeader'
import UnifiedTimeline, { type FeedItem } from './UnifiedTimeline'
import BookingHistoryCard from '@/components/booking/BookingHistoryCard'
import type { DashboardBooking } from '@/components/booking/BookingsDashboard'
import RewardsGrid from '@/components/customer/RewardsGrid'

type Tab = 'upcoming' | 'history' | 'rewards'
type Filter = 'all' | 'bookings' | 'points'

interface UnifiedAccountProps {
  name: string
  userId: string
  initialPoints: number
  earned: number
  redeemed: number
  joinedISO: string
  phone?: string | null
  upcoming: DashboardBooking[]
  rewards: Reward[]
  userPoints: number
  initialPendingMap: Record<string, string>
  feed: FeedItem[]
}

export default function UnifiedAccount(props: UnifiedAccountProps) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [tab, setTab] = useState<Tab>('upcoming')
  const [filter, setFilter] = useState<Filter>('all')

  const tabs: { k: Tab; label: string }[] = [
    { k: 'upcoming', label: t('account.tab.upcoming') },
    { k: 'history', label: t('account.tab.history') },
    { k: 'rewards', label: t('account.tab.rewards') },
  ]

  const filteredFeed = props.feed.filter((it) =>
    filter === 'all' ? true : filter === 'bookings' ? it.kind === 'booking' : it.kind !== 'booking'
  )

  return (
    <div>
      <AccountHeader
        name={props.name}
        userId={props.userId}
        initialPoints={props.initialPoints}
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
                  <span className="font-display text-2xl font-extrabold tracking-tight text-ink-primary">{props.userPoints.toLocaleString('en-US')}</span>
                  <span className={`text-xs text-ink-muted ${my}`}>{t('account.pointsAvailable')}</span>
                </div>
                <div className={`mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted ${my}`}>
                  <Zap size={12} className="text-primary" /> {t('account.earnRate')}
                </div>
              </div>
            </div>

            <div>
              <div className={`font-display text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint ${my}`}>{t('account.redeemKicker')}</div>
              <h2 className={`mb-3 mt-1 font-display text-[17px] font-bold text-ink-primary ${my}`}>{t('account.availableRewards')}</h2>
              <RewardsGrid
                rewards={props.rewards}
                userId={props.userId}
                userPoints={props.userPoints}
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
                    onClick={() => setFilter(k)}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-display text-xs font-semibold ${my} ${
                      on ? 'bg-ink-primary text-white' : 'border border-line bg-surface text-ink-muted'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <UnifiedTimeline items={filteredFeed} />
          </div>
        )}
      </div>
    </div>
  )
}
