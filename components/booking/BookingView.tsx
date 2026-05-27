'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Info, ArrowRight, MapPin, Sun } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  dayHours,
  priceForHour,
  tierForHour,
  isWeekendRate,
  depositFor,
  formatHourRange,
  MAX_SLOTS,
  type SlotState,
} from '@/lib/booking'
import { getHolidayName } from '@/lib/holidays'
import BookingCalendar, { type CalendarData } from './BookingCalendar'
import { PricingLegend } from './Pricing'
import SlotLegend from './SlotLegend'
import TimeSlotGrid, { type SlotView } from './TimeSlotGrid'

export type DayInfo = {
  booked: number[]
  pending: number[]
  closedHours: number[]
  dayClosed: boolean
}

const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WD_MY = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ']
const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

export default function BookingView({
  year,
  monthIdx,
  today,
  calData,
  dayInfo,
  initialDay,
  loggedIn,
}: {
  year: number
  monthIdx: number
  today: string
  calData: CalendarData
  dayInfo: Record<number, DayInfo>
  initialDay: number | null
  loggedIn: boolean
}) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const my = lang === 'my' ? 'my' : ''

  const [selectedDay, setSelectedDay] = useState<number | null>(initialDay)
  const [selected, setSelected] = useState<number[]>([])
  const [limitNotice, setLimitNotice] = useState(false)

  const selectDay = (d: number) => {
    setSelectedDay(d)
    setSelected([])
    setLimitNotice(false)
  }

  const navMonth = (delta: number) => {
    let m = monthIdx + delta
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    router.push(`/book?year=${y}&month=${m + 1}`)
  }

  const toggleSlot = (hour: number) => {
    setSelected((prev) => {
      if (prev.includes(hour)) {
        setLimitNotice(false)
        return prev.filter((h) => h !== hour)
      }
      if (prev.length >= MAX_SLOTS) {
        setLimitNotice(true)
        return prev
      }
      return [...prev, hour].sort((a, b) => a - b)
    })
  }

  const dateISO = selectedDay ? `${year}-${pad(monthIdx + 1)}-${pad(selectedDay)}` : null

  const slots: SlotView[] = dateISO
    ? dayHours().map((hour) => {
        const info = dayInfo[selectedDay!] ?? { booked: [], pending: [], closedHours: [], dayClosed: false }
        let state: SlotState = 'available'
        if (info.dayClosed || info.closedHours.includes(hour)) state = 'closed'
        else if (info.booked.includes(hour)) state = 'booked'
        else if (info.pending.includes(hour)) state = 'pending'
        return { hourStart: hour, price: priceForHour(dateISO, hour), state, tier: tierForHour(dateISO, hour) }
      })
    : []

  const total = dateISO ? selected.reduce((sum, h) => sum + priceForHour(dateISO, h), 0) : 0
  const deposit = depositFor(selected.length)
  const weekendRate = dateISO ? isWeekendRate(dateISO) : false
  const holidayName = dateISO ? getHolidayName(dateISO, lang === 'my' ? 'my' : 'en') : null

  const longDate = (() => {
    if (!dateISO) return ''
    const dt = new Date(year, monthIdx, selectedDay!)
    const wd = (lang === 'my' ? WD_MY : WD_EN)[dt.getDay()]
    if (lang === 'my') return `${wd}နေ့ ၊ ${selectedDay} ၊ ${year}`
    return `${wd}, ${MO_EN[monthIdx]} ${selectedDay}, ${year}`
  })()

  return (
    <div className="pb-36 md:pb-0">
      {/* Court summary */}
      <div className="px-4 pt-3.5 md:px-0">
        <div className="fb-card flex items-center gap-3 p-3.5">
          <div className="fb-photo h-14 w-14 shrink-0 rounded-[10px]" data-photo="court 1" />
          <div className="flex-1">
            <div className={`font-display text-sm font-bold text-ink-primary ${my}`}>
              {t('booking.book.courtName')}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-muted">
              <MapPin size={11} /> <span className={my}>{t('booking.book.location')}</span>
              <span className="mx-1">·</span>
              <Sun size={11} /> <span className={my}>{t('booking.book.roofed')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing legend */}
      <div className="px-4 pt-3 md:px-0">
        <div className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          {t('booking.pricing.title')}
        </div>
        <PricingLegend />
      </div>

      <div className="md:grid md:grid-cols-[1fr_340px] md:gap-7">
        <div>
          {/* Calendar */}
          <div className="px-4 pt-4 md:px-0">
            <div className="md:fb-card md:p-6">
              <BookingCalendar
                year={year}
                monthIdx={monthIdx}
                today={today}
                data={calData}
                selectedDay={selectedDay}
                onSelect={selectDay}
                onNav={navMonth}
              />
            </div>
          </div>

          {/* Time slots */}
          <div className="px-4 pt-5 md:px-0">
            <div className="mb-2.5 flex items-end justify-between">
              <div>
                <div className={`font-display text-base font-bold text-ink-primary ${my}`}>
                  {t('booking.book.pickTime')}
                </div>
                {dateISO && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <Calendar size={11} /> <span className={my}>{longDate}</span>
                    {weekendRate && (
                      <span
                        className="fb-chip"
                        style={{ background: 'var(--color-accent-soft)', color: 'oklch(0.40 0.13 78)', padding: '2px 6px', fontSize: 9 }}
                      >
                        {t('booking.book.weekendRate')}
                      </span>
                    )}
                  </div>
                  {holidayName && (
                    <div className={`mt-0.5 text-[11px] font-medium text-holiday ${my}`}>{holidayName}</div>
                  )}
                )}
              </div>
            </div>
            <SlotLegend dense />
            {dateISO ? (
              <div className="mt-3">
                <TimeSlotGrid slots={slots} selected={selected} onToggle={toggleSlot} showLimitNotice={limitNotice} />
              </div>
            ) : (
              <div className="mt-3 rounded-[var(--r-md)] border border-line bg-surface-alt p-6 text-center text-sm text-ink-muted">
                <span className={my}>{t('booking.book.pickDateTime')}</span>
              </div>
            )}
          </div>

          {/* Cancellation hint */}
          <div className="px-4 pt-3.5 md:px-0">
            <div className={`flex items-center gap-2 rounded-lg bg-surface-alt p-2.5 text-[11px] text-ink-muted ${my}`}>
              <Info size={13} /> <span>{t('booking.book.freeCancel')}</span>
            </div>
          </div>
        </div>

        {/* Desktop summary sidebar */}
        <div className="hidden md:block">
          <div className="sticky top-6 self-start">
            <Summary
              longDate={longDate}
              selected={selected}
              dateISO={dateISO}
              total={total}
              deposit={deposit}
              loggedIn={loggedIn}
            />
          </div>
        </div>
      </div>

      {/* Mobile sticky summary */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-surface px-4 py-3.5 shadow-[0_-8px_24px_rgba(15,40,28,0.06)] md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className={`font-display text-[11px] text-ink-muted ${my}`}>
              {selected.length} {t('booking.summary.slotsDeposit')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[22px] font-extrabold tracking-tight text-ink-primary">
                {total.toLocaleString('en-US')}
              </span>
              <span className="font-fbmono text-[11px] text-ink-muted">MMK</span>
              <span className="font-fbmono text-[11px] text-ink-muted">· {deposit.toLocaleString('en-US')}</span>
            </div>
          </div>
          <ProceedButton selected={selected} dateISO={dateISO} loggedIn={loggedIn} />
        </div>
      </div>
    </div>
  )
}

function ProceedButton({
  selected,
  dateISO,
  loggedIn,
}: {
  selected: number[]
  dateISO: string | null
  loggedIn: boolean
}) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const my = lang === 'my' ? 'my' : ''
  const disabled = selected.length === 0 || !dateISO

  const proceed = () => {
    if (disabled) return
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/book/confirm?date=${dateISO}&slots=${selected.join(',')}`)}`)
      return
    }
    router.push(`/book/confirm?date=${dateISO}&slots=${selected.join(',')}`)
  }

  return (
    <button type="button" className="fb-btn fb-btn-primary !px-4 !py-3.5" disabled={disabled} onClick={proceed}>
      <span className={my}>{loggedIn ? t('booking.book.proceed') : t('booking.book.loginToBook')}</span>
      <ArrowRight size={15} />
    </button>
  )
}

function Summary({
  longDate,
  selected,
  dateISO,
  total,
  deposit,
  loggedIn,
}: {
  longDate: string
  selected: number[]
  dateISO: string | null
  total: number
  deposit: number
  loggedIn: boolean
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  return (
    <div className="fb-card p-5 shadow-fb-md">
      <div className={`font-display text-base font-bold text-ink-primary ${my}`}>
        {t('booking.summary.title')}
      </div>
      <div className="mt-3.5 flex flex-col gap-2.5">
        {dateISO && (
          <div className="flex items-center gap-2.5 rounded-lg bg-surface-alt px-3 py-2.5">
            <Calendar size={14} className="text-ink-muted" />
            <span className={`font-display text-xs font-semibold text-ink-primary ${my}`}>{longDate}</span>
          </div>
        )}

        <div>
          <div className={`mb-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-ink-muted ${my}`}>
            {t('booking.summary.selectedSlots')}
          </div>
          {selected.length === 0 ? (
            <div className="py-2 text-[12px] text-ink-faint">—</div>
          ) : (
            selected.map((h) => (
              <div
                key={h}
                className="flex items-center justify-between border-b border-dashed border-line py-2"
              >
                <span className="inline-flex items-center gap-2">
                  <Clock size={13} className="text-primary" />
                  <span className="font-fbmono text-[13px]">{formatHourRange(h)}</span>
                </span>
                <span className="font-display text-[13px] font-bold">
                  {dateISO ? priceFor(dateISO, h).toLocaleString('en-US') : ''}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between text-[13px] text-ink-muted">
          <span className={my}>{t('booking.summary.total')}</span>
          <span className="font-display text-[22px] font-extrabold text-ink-primary">
            {total.toLocaleString('en-US')}{' '}
            <span className="font-fbmono text-[11px] font-medium text-ink-muted">MMK</span>
          </span>
        </div>

        <div className="flex items-center justify-between rounded-[10px] bg-primary-soft px-3.5 py-3">
          <div>
            <div className={`font-display text-[11px] font-semibold uppercase tracking-wide text-ink-muted ${my}`}>
              {t('booking.summary.depositDue')}
            </div>
            <div className="font-display text-lg font-extrabold text-primary">
              {deposit.toLocaleString('en-US')} MMK
            </div>
          </div>
          <span className="fb-chip" style={{ background: 'var(--color-primary)', color: '#fff' }}>
            {t('booking.summary.perSlot')}
          </span>
        </div>

        <div className={`mt-1 flex items-start gap-2 text-[11px] text-ink-muted ${my}`}>
          <Info size={13} className="mt-px" />
          <span>{t('booking.summary.confirmedAfter')}</span>
        </div>

        <ProceedButtonFull selected={selected} dateISO={dateISO} loggedIn={loggedIn} />
      </div>
    </div>
  )
}

function ProceedButtonFull({
  selected,
  dateISO,
  loggedIn,
}: {
  selected: number[]
  dateISO: string | null
  loggedIn: boolean
}) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const my = lang === 'my' ? 'my' : ''
  const disabled = selected.length === 0 || !dateISO

  const proceed = () => {
    if (disabled) return
    const target = `/book/confirm?date=${dateISO}&slots=${selected.join(',')}`
    router.push(loggedIn ? target : `/login?next=${encodeURIComponent(target)}`)
  }

  return (
    <button type="button" className="fb-btn fb-btn-primary mt-1 w-full !py-3.5" disabled={disabled} onClick={proceed}>
      <span className={my}>{loggedIn ? t('booking.book.proceedToBook') : t('booking.book.loginToBook')}</span>
      <ArrowRight size={15} />
    </button>
  )
}

// local helper to avoid re-importing in JSX scope
function priceFor(dateISO: string, hour: number) {
  return priceForHour(dateISO, hour)
}
