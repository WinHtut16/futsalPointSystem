'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Check, Search, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { dayHours, MAX_SLOTS, DEPOSIT_PER_SLOT } from '@/lib/booking'

type SlotState = 'available' | 'pending' | 'booked' | 'closed'

type SlotInfo = {
  hour: number
  state: SlotState
  tier: 'morning' | 'evening' | 'weekend'
  price: number
}

type CustomerMatch = { id: string; username: string | null; phone: string | null }

function todayYangon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const pad = (n: number) => String(n).padStart(2, '0')

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (ref: string, hadConflict: boolean) => void
}

export default function AdminNewBookingPanel({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useLanguage()

  // Section 1: Customer
  const [phoneQuery, setPhoneQuery] = useState('')
  const [customerMatch, setCustomerMatch] = useState<CustomerMatch | null>(null)
  const [noMatch, setNoMatch] = useState(false)
  const [guestMode, setGuestMode] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Section 2: Date & Slots
  const [date, setDate] = useState(todayYangon)
  const [slotData, setSlotData] = useState<SlotInfo[] | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedHours, setSelectedHours] = useState<number[]>([])
  const [maxSlotsError, setMaxSlotsError] = useState(false)

  const hasPendingConflict = selectedHours.some(
    (h) => slotData?.find((s) => s.hour === h)?.state === 'pending'
  )

  // Section 3: Details
  const [depositTotal, setDepositTotal] = useState(DEPOSIT_PER_SLOT)
  const [depositReceived, setDepositReceived] = useState(false)
  const [source, setSource] = useState<'phone' | 'walk_in' | 'other'>('phone')
  const [notes, setNotes] = useState('')

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchSlots = useCallback(async (d: string) => {
    setLoadingSlots(true)
    setSelectedHours([])
    setMaxSlotsError(false)
    try {
      const res = await fetch(`/api/admin/slot-availability?date=${d}`)
      if (res.ok) {
        const json = await res.json()
        setSlotData(json.slots as SlotInfo[])
      } else {
        setSlotData(null)
      }
    } catch {
      setSlotData(null)
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  // Fetch slots whenever date changes (and panel is open)
  useEffect(() => {
    if (isOpen && date) fetchSlots(date)
  }, [isOpen, date, fetchSlots])

  // Reset all state when panel opens
  useEffect(() => {
    if (!isOpen) return
    setPhoneQuery('')
    setCustomerMatch(null)
    setNoMatch(false)
    setGuestMode(false)
    setGuestName('')
    setGuestPhone('')
    setDate(todayYangon())
    setSlotData(null)
    setSelectedHours([])
    setMaxSlotsError(false)
    setDepositTotal(DEPOSIT_PER_SLOT)
    setDepositReceived(false)
    setSource('phone')
    setNotes('')
    setSubmitError(null)
  }, [isOpen])

  function handlePhoneChange(value: string) {
    setPhoneQuery(value)
    setCustomerMatch(null)
    setNoMatch(false)
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current)
    if (value.length >= 2) {
      phoneDebounce.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/customers?phone=${encodeURIComponent(value)}`)
          if (res.ok) {
            const customers: CustomerMatch[] = await res.json()
            if (customers.length > 0) {
              setCustomerMatch(customers[0])
              setNoMatch(false)
            } else {
              setNoMatch(true)
            }
          }
        } catch {
          // silent — user can still proceed in guest mode
        }
      }, 400)
    }
  }

  function handleSlotClick(hour: number, state: SlotState) {
    if (state === 'booked' || state === 'closed') return
    setMaxSlotsError(false)
    setSelectedHours((prev) => {
      if (prev.includes(hour)) return prev.filter((h) => h !== hour)
      if (prev.length >= MAX_SLOTS) {
        setMaxSlotsError(true)
        return prev
      }
      return [...prev, hour]
    })
  }

  async function handleSubmit() {
    setSubmitError(null)

    if (!date) { setSubmitError('Date required.'); return }
    if (selectedHours.length === 0) { setSubmitError('Select at least one slot.'); return }
    if (!customerMatch && !guestMode) {
      setSubmitError(t('booking.admin.customerRequired' as never))
      return
    }
    if (guestMode && !guestName.trim()) {
      setSubmitError(t('booking.admin.guestRequired' as never))
      return
    }

    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        booking_date: date,
        slots: selectedHours,
        deposit_total: depositTotal,
        deposit_received: depositReceived,
        source,
      }
      if (notes.trim()) body.internal_notes = notes.trim()
      if (customerMatch && !guestMode) {
        body.customer_id = customerMatch.id
      } else {
        body.guest_name = guestName.trim()
        if (guestPhone.trim()) body.guest_phone = guestPhone.trim()
      }

      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Failed to create booking.')
        return
      }
      onSuccess(json.ref as string, json.had_conflict as boolean)
      onClose()
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  function slotTileClass(slot: SlotInfo): string {
    const selected = selectedHours.includes(slot.hour)
    if (selected) return 'bg-primary text-white border-primary'
    if (slot.state === 'booked' || slot.state === 'closed')
      return 'bg-gray-100 text-gray-400 cursor-not-allowed border-transparent'
    if (slot.state === 'pending')
      return 'bg-amber-50 border-amber-200 text-amber-700 cursor-pointer hover:border-amber-400'
    return 'bg-white border-gray-200 text-gray-700 cursor-pointer hover:border-primary'
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel: bottom sheet on mobile, right drawer on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl md:inset-x-auto md:inset-y-0 md:bottom-auto md:right-0 md:max-h-none md:w-[420px] md:overflow-y-auto md:rounded-none md:rounded-l-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 className="text-base font-bold text-gray-900">
            {t('booking.admin.newBookingTitle' as never)}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4 pb-8">
          {/* ── Section 1: Customer ─────────────────── */}
          <section>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('booking.admin.customerPhone' as never)}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={phoneQuery}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="09XXXXXXXXX"
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {customerMatch && !guestMode && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-green-600" />
                <span className="font-semibold text-green-800">{customerMatch.username}</span>
                <span className="ml-auto text-xs text-green-600">
                  {t('booking.admin.linkedAccount' as never)}
                </span>
              </div>
            )}

            {noMatch && !guestMode && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-gray-500">{t('booking.admin.noAccountFound' as never)}</p>
                <button
                  onClick={() => { setGuestMode(true); setGuestPhone(phoneQuery) }}
                  className="text-xs font-semibold text-primary underline underline-offset-2"
                >
                  {t('booking.admin.bookAsGuest' as never)}
                </button>
              </div>
            )}

            {guestMode && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700">
                    {t('booking.admin.guestBooking' as never)}
                  </span>
                  <button
                    onClick={() => { setGuestMode(false); setGuestName(''); setGuestPhone('') }}
                    className="text-xs text-gray-500 underline"
                  >
                    {t('booking.admin.switchToLinked' as never)}
                  </button>
                </div>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={t('booking.admin.guestName' as never)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder={t('booking.admin.guestPhone' as never)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </section>

          {/* ── Section 2: Date & Slots ─────────────── */}
          <section>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('booking.admin.pickDate' as never)}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <label className="mb-1.5 mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('booking.admin.pickSlots' as never)}
            </label>

            {loadingSlots ? (
              <div className="grid animate-pulse grid-cols-4 gap-1.5">
                {dayHours().map((h) => (
                  <div key={h} className="h-12 rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : slotData ? (
              <div className="grid grid-cols-4 gap-1.5">
                {slotData.map((slot) => (
                  <button
                    key={slot.hour}
                    type="button"
                    onClick={() => handleSlotClick(slot.hour, slot.state)}
                    disabled={slot.state === 'booked' || slot.state === 'closed'}
                    className={`flex flex-col items-center rounded-lg border px-1 py-1.5 text-center transition-colors ${slotTileClass(slot)}`}
                  >
                    <span className="text-[11px] font-bold leading-tight">
                      {pad(slot.hour)}:00
                    </span>
                    <span className="text-[9px] opacity-70">
                      {(slot.price / 1000).toFixed(0)}k
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Select a date to load slots.</p>
            )}

            {maxSlotsError && (
              <p className="mt-1.5 text-xs text-red-500">
                {t('booking.admin.maxSlotsReached' as never)}
              </p>
            )}

            {hasPendingConflict && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>{t('booking.admin.slotPendingWarning' as never)}</span>
              </div>
            )}
          </section>

          {/* ── Section 3: Details ──────────────────── */}
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t('booking.admin.depositAmount' as never)}
                </label>
                <input
                  type="number"
                  value={depositTotal}
                  min={0}
                  max={500000}
                  onChange={(e) => setDepositTotal(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t('booking.admin.sourceLabel' as never)}
                </label>
                <div className="flex gap-1">
                  {(['phone', 'walk_in', 'other'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={`flex-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-colors ${
                        source === s
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {s === 'phone'
                        ? t('booking.admin.sourcePhone' as never)
                        : s === 'walk_in'
                          ? t('booking.admin.sourceWalkIn' as never)
                          : t('booking.admin.sourceOther' as never)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Deposit received toggle */}
            <button
              type="button"
              onClick={() => setDepositReceived((v) => !v)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 transition-colors ${
                depositReceived
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              <span className="text-sm font-semibold">
                {depositReceived
                  ? t('booking.admin.depositReceivedLabel' as never)
                  : t('booking.admin.depositPending' as never)}
              </span>
              <div
                className={`relative h-5 w-9 rounded-full transition-colors ${depositReceived ? 'bg-green-500' : 'bg-gray-200'}`}
              >
                <span
                  className={`absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${depositReceived ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </div>
            </button>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t('booking.admin.notesLabel' as never)}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={t('booking.admin.notesPlaceholder' as never)}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </section>

          {/* Error */}
          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</p>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? <Spinner /> : <Plus className="h-4 w-4" />}
            {t('booking.admin.createBooking' as never)}
          </button>
        </div>
      </div>
    </>
  )
}
