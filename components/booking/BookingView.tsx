'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Info, ArrowRight, MapPin, Sun, X, AlertTriangle, Check, Lock } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import BookingLoginSheet from './BookingLoginSheet'
import {
  dayHours,
  priceForHour,
  tierForHour,
  isWeekendRate,
  isSlotBookable,
  formatHourRange,
  MAX_SLOTS,
  DEPOSIT_PER_SLOT,
  type SlotState,
} from '@/lib/booking'
import { getHolidayName } from '@/lib/holidays'
import BookingCalendar, { type CalendarData } from './BookingCalendar'
import { PricingLegend } from './Pricing'
import SlotLegend from './SlotLegend'
import TimeSlotGrid, { type SlotView } from './TimeSlotGrid'
import PendingSlotSheet from './PendingSlotSheet'

export type DayInfo = {
  booked: number[]
  pending: number[]
  closedHours: number[]
  dayClosed: boolean
}

type CartSlot = { date: string; hour: number; override?: boolean }

const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WD_MY = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ']
const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

function shortDateLabel(dateISO: string, lang: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (lang === 'my') return `${WD_MY[wd].slice(0, 3)} ${d} ${MO_EN[m - 1]}`
  return `${WD_EN[wd].slice(0, 3)}, ${MO_EN[m - 1]} ${d}`
}

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
  const [cart, setCart] = useState<CartSlot[]>([])
  const [pendingSheetHour, setPendingSheetHour] = useState<number | null>(null)

  // Post-login booking flow (mobile bottom-sheet). `loggedIn` is the initial
  // server value; once a customer signs in via the sheet we flip locally so the
  // cart is never lost to a navigation/refresh.
  const [authed, setAuthed] = useState(loggedIn)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [welcomeName, setWelcomeName] = useState<string | null>(null)

  const handleSheetSuccess = (name: string) => {
    setSheetOpen(false)
    setAuthed(true)
    setWelcomeName(name)
  }

  // auto-dismiss the welcome toast
  useEffect(() => {
    if (!welcomeName) return
    const id = setTimeout(() => setWelcomeName(null), 5000)
    return () => clearTimeout(id)
  }, [welcomeName])

  const selectDay = (d: number) => {
    setSelectedDay(d)
  }

  const navMonth = (delta: number) => {
    let m = monthIdx + delta
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    router.push(`/book?year=${y}&month=${m + 1}`)
  }

  const toggleSlot = (hour: number) => {
    if (!dateISO) return
    const date = dateISO
    setCart((prev) => {
      const exists = prev.some(s => s.date === date && s.hour === hour)
      if (exists) return prev.filter(s => !(s.date === date && s.hour === hour))
      if (prev.length >= MAX_SLOTS) return prev
      // Block adding a normal slot to a date that already has an override slot
      const dateHasOverride = prev.some(s => s.date === date && s.override)
      if (dateHasOverride) return prev
      return [...prev, { date, hour }].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : a.hour - b.hour
      )
    })
  }

  const handlePendingClick = (hour: number) => {
    if (cart.length >= MAX_SLOTS) return
    setPendingSheetHour(hour)
  }

  const confirmPendingRequest = () => {
    if (!dateISO || pendingSheetHour === null) return
    const date = dateISO
    const hour = pendingSheetHour
    setPendingSheetHour(null)
    setCart((prev) => {
      const exists = prev.some(s => s.date === date && s.hour === hour)
      if (exists || prev.length >= MAX_SLOTS) return prev
      // Block mixing override and non-override slots on the same date:
      // a group with both types would cause the normal slot to be inserted active=false.
      const dateHasNonOverride = prev.some(s => s.date === date && !s.override)
      if (dateHasNonOverride) return prev
      return [...prev, { date, hour, override: true }].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : a.hour - b.hour
      )
    })
  }

  const removeFromCart = (date: string, hour: number) => {
    setCart(prev => prev.filter(s => !(s.date === date && s.hour === hour)))
  }

  const dateISO = selectedDay ? `${year}-${pad(monthIdx + 1)}-${pad(selectedDay)}` : null

  const selectedHoursOnDate = cart
    .filter(s => s.date === dateISO && !s.override)
    .map(s => s.hour)

  const overrideSelectedHoursOnDate = cart
    .filter(s => s.date === dateISO && s.override)
    .map(s => s.hour)

  const slots: SlotView[] = dateISO
    ? dayHours().map((hour) => {
        const info = dayInfo[selectedDay!] ?? { booked: [], pending: [], closedHours: [], dayClosed: false }
        let state: SlotState = 'available'
        if (info.dayClosed || info.closedHours.includes(hour)) state = 'closed'
        else if (info.booked.includes(hour)) state = 'booked'
        else if (info.pending.includes(hour)) state = 'pending'
        else if (!isSlotBookable(dateISO, hour)) state = 'closed'
        return { hourStart: hour, price: priceForHour(dateISO, hour), state, tier: tierForHour(dateISO, hour) }
      })
    : []

  const atMax = cart.length >= MAX_SLOTS
  const total = cart.reduce((sum, s) => sum + priceForHour(s.date, s.hour), 0)
  const uniqueCartDates = [...new Set(cart.map(s => s.date))]
  const deposit = uniqueCartDates.length * DEPOSIT_PER_SLOT

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
                  <>
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
                  </>
                )}
              </div>
            </div>
            <SlotLegend dense />
            {dateISO ? (
              <div className="mt-3">
                <TimeSlotGrid
                  slots={slots}
                  selected={selectedHoursOnDate}
                  overrideSelected={overrideSelectedHoursOnDate}
                  onToggle={toggleSlot}
                  onPendingClick={atMax ? undefined : handlePendingClick}
                  atMax={atMax}
                />
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
              cart={cart}
              total={total}
              deposit={deposit}
              onRemove={removeFromCart}
              loggedIn={loggedIn}
              lang={lang}
            />
          </div>
        </div>
      </div>

      {/* Mobile sticky summary */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-surface px-4 py-3.5 shadow-[0_-8px_24px_rgba(15,40,28,0.06)] md:hidden">
        {authed && welcomeName && (
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 font-display text-[11px] font-bold text-primary">
            <Check size={12} strokeWidth={2.6} />
            <span className={my}>{t('booking.login.loggedInAs', { name: welcomeName })}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <div className={`font-display text-[11px] text-ink-muted ${my}`}>
              {cart.length} {t('booking.summary.slotsDeposit')}
              {cart.length > 0 && (
                <span className="font-fbmono"> · {total.toLocaleString('en-US')} MMK {t('booking.summary.total')}</span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`font-display text-[13px] font-semibold text-ink-muted ${my}`}>
                {t('booking.summary.depositLabel')}:
              </span>
              <span className="font-display text-[20px] font-extrabold tracking-tight text-ink-primary">
                {deposit.toLocaleString('en-US')}
              </span>
              <span className="font-fbmono text-[11px] text-ink-muted">MMK</span>
              {cart.some(s => s.override) && (
                <span
                  className="ml-1 rounded px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide"
                  style={{ background: 'var(--color-slot-pending-bg)', color: 'oklch(0.50 0.13 78)' }}
                >
                  Priority
                </span>
              )}
            </div>
          </div>
          <ProceedButton
            cart={cart}
            authed={authed}
            justLoggedIn={!!welcomeName}
            onLoginNeeded={() => setSheetOpen(true)}
          />
        </div>
      </div>

      {/* Welcome-back toast (after sheet login) */}
      {welcomeName && (
        <div
          className="fixed inset-x-4 top-4 z-30 flex items-center gap-3 rounded-[var(--r-md)] px-3.5 py-3 text-white md:hidden"
          style={{ background: 'var(--color-primary)', boxShadow: '0 10px 28px -6px rgba(15,40,28,0.45)' }}
        >
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white/20">
            <Check size={16} strokeWidth={2.6} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`font-display text-[13.5px] font-bold leading-tight ${my}`}>
              {t('booking.login.welcome', { name: welcomeName })}
            </div>
            <div className={`mt-0.5 text-[11.5px] opacity-90 ${my}`}>{t('booking.login.welcomeSub')}</div>
          </div>
          <button type="button" onClick={() => setWelcomeName(null)} aria-label="Dismiss" className="shrink-0 opacity-70">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bottom-sheet login (mobile-preferred) */}
      <BookingLoginSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSuccess={handleSheetSuccess}
        nextTarget={buildProceedTarget(cart)}
      />

      {/* Pending slot bottom sheet */}
      <PendingSlotSheet
        hour={pendingSheetHour}
        onConfirm={confirmPendingRequest}
        onClose={() => setPendingSheetHour(null)}
      />
    </div>
  )
}

function buildProceedTarget(cart: CartSlot[]): string {
  const itemsParam = cart.map(s => `${s.date}_${s.hour}`).join(',')
  const overrides = cart.filter(s => s.override).map(s => `${s.date}_${s.hour}`).join(',')
  return overrides
    ? `/book/confirm?items=${itemsParam}&overrides=${overrides}`
    : `/book/confirm?items=${itemsParam}`
}

function ProceedButton({
  cart,
  authed,
  justLoggedIn,
  onLoginNeeded,
}: {
  cart: CartSlot[]
  authed: boolean
  justLoggedIn: boolean
  onLoginNeeded: () => void
}) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const my = lang === 'my' ? 'my' : ''
  const disabled = cart.length === 0

  const proceed = () => {
    if (disabled) return
    if (!authed) {
      onLoginNeeded()
      return
    }
    router.push(buildProceedTarget(cart))
  }

  const label = !authed
    ? t('booking.book.loginToBook')
    : justLoggedIn
      ? t('booking.login.confirmBooking')
      : t('booking.book.proceed')

  return (
    <button type="button" className="fb-btn fb-btn-primary !px-4 !py-3.5" disabled={disabled} onClick={proceed}>
      {!authed && <Lock size={14} />}
      <span className={my}>{label}</span>
      <ArrowRight size={15} />
    </button>
  )
}

function Summary({
  cart,
  total,
  deposit,
  onRemove,
  loggedIn,
  lang,
}: {
  cart: CartSlot[]
  total: number
  deposit: number
  onRemove: (date: string, hour: number) => void
  loggedIn: boolean
  lang: string
}) {
  const { t } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  return (
    <div className="fb-card p-5 shadow-fb-md">
      <div className={`font-display text-base font-bold text-ink-primary ${my}`}>
        {t('booking.summary.title')}
      </div>
      <div className="mt-3.5 flex flex-col gap-2.5">
        <div>
          <div className={`mb-1.5 font-display text-[11px] font-semibold uppercase tracking-wide text-ink-muted ${my}`}>
            {t('booking.summary.selectedSlots')}
          </div>
          {cart.length === 0 ? (
            <div className="py-2 text-[12px] text-ink-faint">—</div>
          ) : (
            cart.map((s) => (
              <div
                key={`${s.date}-${s.hour}`}
                className="flex items-center justify-between border-b border-dashed border-line py-2"
                style={s.override ? { borderLeft: '2px solid var(--color-slot-pending)', paddingLeft: '8px' } : undefined}
              >
                <span className="inline-flex items-center gap-2">
                  <Clock size={13} className={s.override ? 'text-slot-pending' : 'text-primary'} />
                  <span className="flex flex-col">
                    <span className="font-display text-[11px] text-ink-muted">{shortDateLabel(s.date, lang)}</span>
                    <span className="font-fbmono text-[13px]">{formatHourRange(s.hour)}</span>
                    {s.override && (
                      <span
                        className="mt-0.5 font-display text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: 'oklch(0.50 0.13 78)' }}
                      >
                        {t('booking.pending.priorityLabel')}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-display text-[13px] font-bold">
                    {priceForHour(s.date, s.hour).toLocaleString('en-US')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(s.date, s.hour)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-alt text-ink-muted transition-colors hover:bg-slot-booked-bg hover:text-slot-booked"
                    aria-label="Remove slot"
                  >
                    <X size={11} />
                  </button>
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

        <ProceedButtonFull cart={cart} loggedIn={loggedIn} />
      </div>
    </div>
  )
}

function ProceedButtonFull({
  cart,
  loggedIn,
}: {
  cart: CartSlot[]
  loggedIn: boolean
}) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const my = lang === 'my' ? 'my' : ''
  const disabled = cart.length === 0

  const proceed = () => {
    if (disabled) return
    const target = buildProceedTarget(cart)
    router.push(loggedIn ? target : `/login?next=${encodeURIComponent(target)}`)
  }

  return (
    <button type="button" className="fb-btn fb-btn-primary mt-1 w-full !py-3.5" disabled={disabled} onClick={proceed}>
      <span className={my}>{loggedIn ? t('booking.book.proceedToBook') : t('booking.book.loginToBook')}</span>
      <ArrowRight size={15} />
    </button>
  )
}
