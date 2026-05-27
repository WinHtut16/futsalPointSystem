'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, Calendar, Clock, Wallet, Shield, CreditCard, ArrowRight, Banknote,
  Copy, MessageCircle, Phone, ArrowUpRight, Info, CalendarCheck, AlertTriangle,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { priceForHour, tierForHour, depositFor, formatHourRange, isWeekendRate } from '@/lib/booking'

const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WD_MY = ['တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ']
const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const BANK = { name: 'KBZ Bank', number: '0123 4567 8910 11', holder: 'Myathida Futsal Co., Ltd.' }
const PHONE = '+95 9 797 272000'
const VIBER_URL = 'viber://chat?number=%2B959797272000'

export default function ConfirmFlow({
  bookingDate,
  slots,
}: {
  bookingDate: string
  slots: number[]
}) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const my = lang === 'my' ? 'my' : ''

  const [step, setStep] = useState(1)
  const [ref, setRef] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [y, m, d] = bookingDate.split('-').map(Number)
  const wd = (lang === 'my' ? WD_MY : WD_EN)[new Date(y, m - 1, d).getDay()]
  const longDate = lang === 'my' ? `${wd}နေ့ ၊ ${d} ၊ ${y}` : `${wd}, ${MO_EN[m - 1]} ${d}, ${y}`
  const shortDate = lang === 'my' ? `${wd}နေ့ ၊ ${d}` : `${wd.slice(0, 3)} · ${MO_EN[m - 1]} ${d}, ${y}`
  const weekend = isWeekendRate(bookingDate)

  const total = slots.reduce((s, h) => s + priceForHour(bookingDate, h), 0)
  const deposit = depositFor(slots.length)
  const timeRange =
    slots.length === 1
      ? formatHourRange(slots[0])
      : `${String(Math.min(...slots)).padStart(2, '0')}:00 – ${String(Math.max(...slots) + 1).padStart(2, '0')}:00`

  async function createBooking() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_date: bookingDate, slots }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.')
        return
      }
      setRef(json.ref)
      setStep(2)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
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

            <Row icon={<Calendar size={14} />} label={t('booking.summary.date')}>
              <span className={`font-display text-[13px] font-bold text-ink-primary ${my}`}>{longDate}</span>
            </Row>

            <div className="border-b border-line py-3.5">
              <div className="mb-2 inline-flex items-center gap-2 text-[12px] text-ink-muted">
                <Clock size={14} /> <span className={my}>{t('booking.confirm.time')}</span>
              </div>
              {slots.map((h) => (
                <div key={h} className="flex items-center justify-between py-1.5">
                  <span className="font-fbmono text-[13px] text-ink-primary">{formatHourRange(h)}</span>
                  <span className="flex items-center gap-2">
                    {weekend && (
                      <span className="fb-chip" style={{ background: 'var(--color-accent-soft)', color: 'oklch(0.40 0.13 78)', fontSize: 9 }}>
                        {t('booking.book.weekendRate')}
                      </span>
                    )}
                    <span className="font-display text-sm font-bold text-ink-primary">
                      {priceForHour(bookingDate, h).toLocaleString('en-US')}
                    </span>
                  </span>
                </div>
              ))}
            </div>

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
              <div className="font-display text-[22px] font-extrabold text-primary">{deposit.toLocaleString('en-US')} MMK</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white">
              <Wallet size={24} />
            </div>
          </div>

          {error && <ErrorNote msg={error} />}

          <button
            type="button"
            onClick={createBooking}
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
            {t('booking.confirm.transfer')} · {deposit.toLocaleString('en-US')} MMK
          </div>
          <p className={`text-[13px] text-ink-muted ${my}`}>{t('booking.confirm.transferSub')}</p>

          <div
            className="fb-card mt-4 border-0 p-4 text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className={`font-display text-[11px] font-semibold uppercase tracking-widest opacity-70 ${my}`}>
                  {t('booking.confirm.bankAccount')}
                </div>
                <div className="mt-1 font-display text-base font-bold">{BANK.name}</div>
              </div>
              <Banknote size={22} className="opacity-80" />
            </div>
            <div className="mt-4 font-fbmono text-[22px] font-bold tracking-wider">{BANK.number}</div>
            <div className="mt-1.5 text-xs opacity-85">{BANK.holder}</div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(BANK.number.replace(/\s/g, ''))}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/20 px-3.5 py-2.5 font-display text-xs font-semibold"
            >
              <Copy size={13} /> <span className={my}>{t('booking.confirm.copyAccount')}</span>
            </button>
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
            <div className="mt-1 font-fbmono text-[22px] font-bold tracking-wider text-ink-primary">{ref ?? '—'}</div>
            <hr className="fb-divider my-3.5" />
            <Line icon={<Calendar size={13} />} label={t('booking.summary.date')} value={shortDate} mono={false} myVal />
            <Line icon={<Clock size={13} />} label={t('booking.confirm.time')} value={timeRange} mono />
            <Line icon={<Wallet size={13} />} label={t('booking.confirm.deposit')} value={`${deposit.toLocaleString('en-US')} MMK`} mono={false} />
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
            <button type="button" onClick={() => router.push('/bookings')} className="fb-btn fb-btn-primary flex-1">
              <span className={my}>{t('booking.confirm.viewBookings')}</span> <ArrowRight size={14} />
            </button>
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
