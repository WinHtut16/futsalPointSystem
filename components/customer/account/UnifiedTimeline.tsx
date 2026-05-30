'use client'

import { Zap, Gift, Pencil, Calendar } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { BookingStatus } from '@/components/booking/BookingHistoryCard'

// One chronological feed interleaving booking events and points transactions.
// Built server-side and passed down already serialized (no client fetching).
export type FeedItem =
  | { kind: 'booking'; ts: string; status: BookingStatus; timeLabel: string; dateLabel: string; meta: string }
  | { kind: 'earn' | 'redeem' | 'adjust'; ts: string; dateLabel: string; delta: number; detail: string }

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MY_MONTHS = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ']
const MY_DIGITS = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉']
const toMyDigits = (n: number) => String(n).replace(/\d/g, (d) => MY_DIGITS[+d])

const statusCls: Record<BookingStatus, string> = {
  confirmed: 'pill-available',
  pending: 'pill-pending',
  closed: 'pill-closed',
  cancelled: 'pill-booked',
}

function TimelineNode({ item }: { item: FeedItem }) {
  const map = {
    earn: { Ic: Zap, bg: 'var(--color-slot-available-bg)', c: 'var(--color-slot-available)' },
    redeem: { Ic: Gift, bg: 'var(--color-accent-soft)', c: 'oklch(0.45 0.13 78)' },
    adjust: { Ic: Pencil, bg: 'var(--color-surface-alt)', c: 'var(--color-text-muted)' },
    booking: { Ic: Calendar, bg: 'var(--color-primary-soft)', c: 'var(--color-primary)' },
  }
  const m = map[item.kind]
  return (
    <div
      className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: m.bg, color: m.c, border: '3px solid var(--color-background)', boxShadow: '0 0 0 1px var(--color-line)' }}
    >
      <m.Ic size={17} />
    </div>
  )
}

export default function UnifiedTimeline({ items }: { items: FeedItem[] }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  if (items.length === 0) {
    return (
      <div className="fb-card p-8 text-center text-sm text-ink-muted">
        <span className={my}>{t('account.noHistory')}</span>
      </div>
    )
  }

  // group by YYYY-MM, preserving the (already desc-sorted) order
  const groups: { key: string; label: string; items: FeedItem[] }[] = []
  for (const it of items) {
    const d = new Date(it.ts)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const label = lang === 'my'
      ? `${MY_MONTHS[d.getMonth()]} ${toMyDigits(d.getFullYear())}`
      : `${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`
    let g = groups.find((x) => x.key === key)
    if (!g) { g = { key, label, items: [] }; groups.push(g) }
    g.items.push(it)
  }

  const pointsLabel = (k: 'earn' | 'redeem' | 'adjust') =>
    k === 'earn' ? t('tx.played') : k === 'redeem' ? t('tx.redemption') : t('tx.adjustment')

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.key}>
          <div className={`mb-3 px-0.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-ink-faint ${my}`}>
            {g.label}
          </div>
          <div className="relative">
            <div className="absolute bottom-2 left-[18px] top-2 w-0.5" style={{ background: 'var(--color-line)' }} />
            <div className="relative flex flex-col gap-3.5">
              {g.items.map((it, i) => (
                <div key={i} className="flex items-start gap-3.5">
                  <TimelineNode item={it} />
                  <div
                    className="fb-card flex flex-1 items-center justify-between gap-2.5 px-3.5 py-3"
                    style={{ opacity: it.kind === 'booking' && it.status === 'cancelled' ? 0.72 : 1 }}
                  >
                    <div className="min-w-0">
                      {it.kind === 'booking' ? (
                        <div className={`font-display text-[13.5px] font-bold leading-tight text-ink-primary ${my}`}>
                          {t('account.bookingEvent')} · <span className="font-fbmono">{it.timeLabel}</span>
                        </div>
                      ) : (
                        <div className={`font-display text-[13.5px] font-bold leading-tight text-ink-primary ${my}`}>
                          {pointsLabel(it.kind)}{it.detail ? ` · ${it.detail}` : ''}
                        </div>
                      )}
                      <div className="mt-0.5 font-fbmono text-[11px] text-ink-muted">{it.dateLabel}</div>
                      {it.kind === 'booking' && it.meta && (
                        <div className="mt-0.5 font-fbmono text-[10.5px] text-ink-faint">{it.meta}</div>
                      )}
                    </div>
                    {it.kind === 'booking' ? (
                      <span className={`fb-chip ${statusCls[it.status]} flex-shrink-0 px-2.5 py-1`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        <span className={my}>{t(`booking.status.${it.status}` as never)}</span>
                      </span>
                    ) : (
                      <span
                        className="flex-shrink-0 font-display text-[15px] font-extrabold tracking-tight"
                        style={{ color: it.delta >= 0 ? 'var(--color-slot-available)' : 'var(--color-slot-booked)' }}
                      >
                        {it.delta >= 0 ? '+' : '−'}{Math.abs(it.delta)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
