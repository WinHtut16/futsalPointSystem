'use client'

import { Fragment, useState } from 'react'
import Image from 'next/image'
import {
  Check, Calendar, Clock, Wallet, Shield, CreditCard, ArrowRight,
  Copy, MessageCircle, Phone, ArrowUpRight, Info, CalendarCheck, AlertTriangle,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { priceForHour, depositFor, formatHourRange, isWeekendRate, DEPOSIT_PER_SLOT } from '@/lib/booking'

const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WD_MY = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ']
const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MO_MY = ['ဇန်', 'ဖေ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူ', 'ဩ', 'စက်', 'အောက်', 'နို', 'ဒီ']

const KBZPAY = { number: '09 5190 865', holder: 'Aung Thura Phyo' }
const PHONE = '+95 9 797 272000'
const VIBER_URL = 'viber://chat?number=%2B959797272000'

type BookingGroup = { date: string; hours: number[]; overrideHours?: number[] }

function longDateStr(date: string, lang: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = (lang === 'my' ? WD_MY : WD_EN)[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return lang === 'my' ? `${wd}နေ့ ၊ ${d} ၊ ${y}` : `${wd}, ${MO_EN[m - 1]} ${d}, ${y}`
}

function shortDateStr(date: string, lang: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = (lang === 'my' ? WD_MY : WD_EN)[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return lang === 'my'
    ? `${wd}နေ့ ၊ ${d} ${MO_MY[m - 1]} ${y}`
    : `${wd.slice(0, 3)} · ${MO_EN[m - 1]} ${d}, ${y}`
}

function timeRangeFor(hours: number[]): string {
  if (hours.length === 1) return formatHourRange(hours[0])
  return `${String(Math.min(...hours)).padStart(2, '0')}:00 – ${String(Math.max(...hours) + 1).padStart(2, '0')}:00`
}

export default function ConfirmFlow({
  bookings,
}: {
  bookings: BookingGroup[]
}) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  const [step, setStep] = useState(1)
  const [refs, setRefs] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const total = bookings.reduce((sum, g) =>
    sum + g.hours.reduce((s, h) => s + priceForHour(g.date, h), 0), 0)
  // One deposit per booking date
  const totalDeposit = bookings.length * DEPOSIT_PER_SLOT

  async function createBookings() {
    setSubmitting(true)
    setError(null)
    const createdRefs: { date: string; bookingId: string; ref: string }[] = []
    try {
      for (const g of bookings) {
        const hasOverride = g.overrideHours && g.overrideHours.length > 0
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_date: g.date,
            slots: g.hours,
            ...(hasOverride ? { override_request: true } : {}),
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          // Partial failure — attempt to auto-cancel all bookings created so far.
          const cancelErrors: string[] = []
          for (const created of createdRefs) {
            const cancelRes = await fetch(`/api/bookings/${created.bookingId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'cancel' }),
            })
            if (!cancelRes.ok) cancelErrors.push(created.ref)
          }

          if (cancelErrors.length > 0) {
            setError(t('booking.confirm.errorCancelFail', { refs: cancelErrors.join(', ') }))
          } else {
            setError(t('booking.confirm.errorSlotTaken', { date: g.date }))
          }
          return
        }
        createdRefs.push({ date: g.date, bookingId: json.id, ref: json.ref })
      }
      setRefs(createdRefs.map((c) => c.ref))
      setStep(2)
    } catch {
      setError(t('booking.confirm.errorNetwork'))
    } finally {
      setSubmitting(false)
    }
  }

  async function copyKbzNumber() {
    const num = KBZPAY.number.replace(/\s/g, '')
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(num)
      } else {
        const ta = document.createElement('textarea')
        ta.value = num
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silently ignore — clipboard access denied
    }
  }

  return (
    <div className="pb-28">
      <Stepper step={step} />

      {step === 1 && (
        <div className="px-4 pb-4">
          <div className={`mb-1.5 font-display text-[22px] font-extrabold tracking-tight text-ink-primary ${my}`}>
            {t('booking.confirm.review')}
          </div>
          <p className={`mb-4 text-[13px] text-ink-muted ${my}`}>{t('booking.confirm.reviewSub')}</p>

          <div className="fb-card p-4">
            <div className="flex items-center gap-3 border-b border-line pb-3.5">
              <div className="fb-photo h-14 w-14 rounded-[10px]" data-photo="court" />
              <div>
                <div className={`font-display text-sm font-bold text-ink-primary ${my}`}>
                  {t('booking.book.courtName')}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
                  <Calendar size={11} /> <span className={my}>{t('booking.book.location')}</span>
                </div>
              </div>
            </div>

            {bookings.map((g, i) => {
              const lDate = longDateStr(g.date, lang)
              const weekend = isWeekendRate(g.date)
              return (
                <Fragment key={g.date}>
                  <Row icon={<Calendar size={14} />} label={t('booking.summary.date')}>
                    <span className={`font-display text-[13px] font-bold text-ink-primary ${my}`}>{lDate}</span>
                  </Row>
                  <div className={i < bookings.length - 1 ? 'border-b border-line py-3.5' : 'py-3.5'}>
                    <div className="mb-2 inline-flex items-center gap-2 text-[12px] text-ink-muted">
                      <Clock size={14} /> <span className={my}>{t('booking.confirm.time')}</span>
                    </div>
                    {g.hours.map((h) => (
                      <div key={h} className="flex items-center justify-between py-1.5">
                        <span className="font-fbmono text-[13px] text-ink-primary">{formatHourRange(h)}</span>
                        <span className="flex items-center gap-2">
                          {weekend && (
                            <span className="fb-chip" style={{ background: 'var(--color-accent-soft)', color: 'oklch(0.40 0.13 78)', fontSize: 9 }}>
                              {t('booking.book.weekendRate')}
                            </span>
                          )}
                          <span className="font-display text-sm font-bold text-ink-primary">
                            {priceForHour(g.date, h).toLocaleString('en-US')}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </Fragment>
              )
            })}

            <div className="flex items-baseline justify-between pt-3.5">
              <span className={`font-display text-[13px] text-ink-muted ${my}`}>{t('booking.summary.total')}</span>
              <span className="font-display text-[26px] font-extrabold tracking-tight text-ink-primary">
                {total.toLocaleString('en-US')}{' '}
                <span className="font-fbmono text-[11px] font-medium text-ink-muted">MMK</span>
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-primary-soft p-4">
            <div>
              <div className={`font-display text-[11px] font-semibold uppercase tracking-wide text-ink-muted ${my}`}>
                {t('booking.confirm.payNow')}
              </div>
              <div className="font-display text-[22px] font-extrabold text-primary">{totalDeposit.toLocaleString('en-US')} MMK</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white">
              <Wallet size={24} />
            </div>
          </div>

          {error && <ErrorNote msg={error} />}

          {bookings.some(g => g.overrideHours && g.overrideHours.length > 0) && (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-[var(--r-md)] p-3.5"
              style={{ background: 'var(--color-slot-pending-bg)', border: '1px solid var(--color-slot-pending)' }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-slot-pending)' }} />
              <p className={`text-[12px] leading-snug ${my}`} style={{ color: 'oklch(0.40 0.13 78)' }}>
                {t('booking.pending.overrideNotice')}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={createBookings}
            disabled={submitting}
            className="fb-btn fb-btn-primary mt-5 w-full !py-4"
          >
            <CreditCard size={15} />
            <span className={my}>{t('booking.confirm.continuePayment')}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="px-4 pb-4">
          <div className={`mb-1.5 font-display text-[22px] font-extrabold tracking-tight text-ink-primary ${my}`}>
            {t('booking.confirm.transfer')} · {totalDeposit.toLocaleString('en-US')} MMK
          </div>
          <p className={`text-[13px] text-ink-muted ${my}`}>{t('booking.confirm.transferSub')}</p>

          <div className="fb-card mt-4 p-4">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-alt">
                <Image
                  src="/images/kbz-pay.webp"
                  alt="KBZ Pay"
                  width={200}
                  height={200}
                  className="h-14 w-auto object-contain"
                />
              </div>
              <div>
                <div className={`font-display text-[11px] font-semibold uppercase tracking-widest text-ink-muted ${my}`}>
                  {t('booking.confirm.bankAccount')}
                </div>
                <div className="mt-0.5 font-display text-base font-bold text-ink-primary">KBZ Pay</div>
              </div>
            </div>
            <div className="mt-4 font-fbmono text-[22px] font-bold tracking-wider text-ink-primary">{KBZPAY.number}</div>
            <div className="mt-1.5 text-sm text-ink-muted">{KBZPAY.holder}</div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={copyKbzNumber}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-alt px-3.5 py-2.5 font-display text-xs font-semibold text-ink-primary"
              >
                {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
                <span className={my}>{t('booking.confirm.copyAccount')}</span>
              </button>
              {copied && (
                <span className="font-display text-[11px] font-semibold text-primary">
                  {t('booking.confirm.copied')}
                </span>
              )}
            </div>
          </div>

          <div className={`mb-2 mt-6 font-display text-[11px] font-bold uppercase tracking-widest text-ink-muted ${my}`}>
            {t('booking.confirm.notifyUs')}
          </div>

          <a href={VIBER_URL} className="fb-card flex items-center gap-3.5 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-white" style={{ background: 'oklch(0.45 0.18 295)' }}>
              <MessageCircle size={20} />
            </div>
            <div className="flex-1">
              <div className={`font-display text-sm font-bold text-ink-primary ${my}`}>{t('booking.confirm.viberTitle')}</div>
              <div className="mt-0.5 font-fbmono text-[12px]" style={{ color: 'oklch(0.45 0.18 295)' }}>{PHONE}</div>
            </div>
            <ArrowUpRight size={16} className="text-primary" />
          </a>

          <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="fb-card mt-2.5 flex items-center gap-3.5 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white">
              <Phone size={20} />
            </div>
            <div className="flex-1">
              <div className={`font-display text-sm font-bold text-ink-primary ${my}`}>{t('booking.confirm.phoneTitle')}</div>
              <div className="mt-0.5 font-fbmono text-[12px] text-primary">{PHONE}</div>
            </div>
            <ArrowUpRight size={16} className="text-primary" />
          </a>

          <div className={`mt-4 flex items-start gap-2 rounded-lg bg-surface-alt p-3 text-[11px] text-ink-muted ${my}`}>
            <Info size={14} className="mt-px shrink-0" /> <span>{t('booking.confirm.phoneNote')}</span>
          </div>

          <button type="button" onClick={() => setStep(3)} className="fb-btn fb-btn-primary mt-5 w-full !py-4">
            <Check size={15} /> <span className={my}>{t('booking.confirm.submit')}</span>
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="px-4 pb-4">
          <div className="px-2 pt-2 text-center">
            <div className="mb-4 inline-flex h-[88px] w-[88px] items-center justify-center rounded-full bg-primary-soft text-primary">
              <CalendarCheck size={42} strokeWidth={2} />
            </div>
            <div className={`font-display text-2xl font-extrabold tracking-tight text-ink-primary ${my}`}>
              {t('booking.confirm.submitted')}
            </div>
            <p className={`mx-4 mt-2 text-[13px] leading-relaxed text-ink-muted ${my}`}>
              {t('booking.confirm.submittedSub')}
            </p>
          </div>

          <div className="fb-card mt-4 p-4">
            <div className="flex items-center justify-between">
              <div className={`font-display text-[11px] font-bold uppercase tracking-widest text-ink-muted ${my}`}>
                {t('booking.confirm.ref')}
              </div>
              <span className="fb-chip pill-pending">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <span className={my}>{t('booking.confirm.pendingConfirmation')}</span>
              </span>
            </div>

            {refs.map((ref, i) => (
              <Fragment key={ref}>
                {i > 0 && <hr className="fb-divider my-3.5" />}
                <div className="mt-1 font-fbmono text-[22px] font-bold tracking-wider text-ink-primary">{ref}</div>
                <hr className="fb-divider my-3.5" />
                <Line icon={<Calendar size={13} />} label={t('booking.summary.date')} value={shortDateStr(bookings[i].date, lang)} mono={false} myVal />
                <Line icon={<Clock size={13} />} label={t('booking.confirm.time')} value={timeRangeFor(bookings[i].hours)} mono />
                <Line icon={<Wallet size={13} />} label={t('booking.confirm.deposit')} value={`${depositFor(bookings[i].hours.length).toLocaleString('en-US')} MMK`} mono={false} />
              </Fragment>
            ))}
          </div>

          <div className="fb-card mt-3.5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Shield size={14} className="text-primary" />
              <span className={`font-display text-[13px] font-bold text-ink-primary ${my}`}>{t('booking.policy.title')}</span>
            </div>
            <div className={`text-[12px] leading-relaxed text-ink-muted ${my}`}>
              <strong className="text-ink-primary">{t('booking.policy.before')}</strong> {t('booking.policy.beforeBody')}
              <br />
              <strong className="text-ink-primary">{t('booking.policy.within')}</strong> {t('booking.policy.withinBody')}
            </div>
          </div>

          <div className="mt-5 flex gap-2.5">
            <a href={VIBER_URL} className="fb-btn fb-btn-ghost flex-1">
              <MessageCircle size={14} /> <span className={my}>{t('booking.confirm.openViber')}</span>
            </a>
            <a href="/account" className="fb-btn fb-btn-primary flex-1">
              <span className={my}>{t('booking.confirm.viewBookings')}</span> <ArrowRight size={14} />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function Stepper({ step }: { step: number }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const labels = [t('booking.confirm.stepSummary'), t('booking.confirm.stepPayment'), t('booking.confirm.stepSubmitted')]
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      {labels.map((l, i) => {
        const idx = i + 1
        const active = idx === step
        const done = idx < step
        return (
          <div key={i} className="flex flex-1 items-center gap-2">
            <div
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold"
              style={{
                background: done || active ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                color: done || active ? '#fff' : 'var(--color-text-muted)',
                border: active || done ? '0' : '1px solid var(--color-line)',
              }}
            >
              {done ? <Check size={12} strokeWidth={2.6} /> : idx}
            </div>
            <span
              className={`font-display text-[12px] ${active ? 'font-bold' : 'font-semibold'} ${my}`}
              style={{ color: active || done ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
            >
              {l}
            </span>
            {i < 2 && <div className="h-px flex-[0_0_12px] bg-line" />}
          </div>
        )
      })}
    </div>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const { lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <div className="flex items-center justify-between border-b border-line py-3.5">
      <span className="inline-flex items-center gap-2 text-[12px] text-ink-muted">
        {icon} <span className={my}>{label}</span>
      </span>
      {children}
    </div>
  )
}

function Line({
  icon, label, value, mono, myVal,
}: {
  icon: React.ReactNode; label: string; value: string; mono: boolean; myVal?: boolean
}) {
  const { lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="inline-flex items-center gap-2 text-ink-muted">
        {icon} <span className={my}>{label}</span>
      </span>
      <span className={`${mono ? 'font-fbmono' : 'font-display'} font-semibold ${myVal ? my : ''}`}>{value}</span>
    </div>
  )
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-[var(--r-md)] border border-slot-booked bg-slot-booked-bg p-3 text-[12px] text-slot-booked">
      <AlertTriangle size={15} className="mt-px shrink-0" />
      <span>{msg}</span>
    </div>
  )
}
