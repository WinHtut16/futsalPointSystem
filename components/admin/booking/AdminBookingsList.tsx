'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Phone, Clock, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'closed'

export type AdminBooking = {
  id: string
  ref: string
  status: BookingStatus
  booking_date: string
  deposit_total: number
  deposit_received: boolean
  override_request: boolean
  customer: { username: string | null; phone: string | null } | null
  hours: number[]
}

const POLL_MS = 20_000
const SELECT_QUERY =
  'id, ref, status, booking_date, deposit_total, deposit_received, override_request, customer:profiles(username, phone), booking_slots(hour_start)'

type RawRow = Record<string, unknown>

function parseRow(b: RawRow): AdminBooking {
  const rawCustomer = b.customer
  const customer = Array.isArray(rawCustomer)
    ? (rawCustomer as RawRow[])[0]
    : (rawCustomer as RawRow | null)
  return {
    id: b.id as string,
    ref: b.ref as string,
    status: b.status as AdminBooking['status'],
    booking_date: b.booking_date as string,
    deposit_total: (b.deposit_total as number) ?? 0,
    deposit_received: (b.deposit_received as boolean) ?? false,
    override_request: (b.override_request as boolean) ?? false,
    customer: customer
      ? { username: customer.username as string | null, phone: customer.phone as string | null }
      : null,
    hours: ((b.booking_slots as { hour_start: number }[]) ?? []).map((s) => s.hour_start),
  }
}

const FILTER_KEYS: { k: 'all' | BookingStatus; labelKey: string }[] = [
  { k: 'all', labelKey: 'booking.admin.all' },
  { k: 'pending', labelKey: 'booking.status.pending' },
  { k: 'confirmed', labelKey: 'booking.status.confirmed' },
  { k: 'cancelled', labelKey: 'booking.status.cancelled' },
  { k: 'closed', labelKey: 'booking.status.closed' },
]

const statusStyle: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  closed: 'bg-gray-200 text-gray-600',
}

const statusKey: Record<BookingStatus, string> = {
  pending: 'booking.status.pending',
  confirmed: 'booking.status.confirmed',
  cancelled: 'booking.status.cancelled',
  closed: 'booking.status.closed',
}

const pad = (n: number) => String(n).padStart(2, '0')

function timeLabel(hours: number[]) {
  if (hours.length === 0) return '—'
  const sorted = [...hours].sort((a, b) => a - b)
  return `${pad(sorted[0])}:00 – ${pad(sorted[sorted.length - 1] + 1)}:00`
}

export default function AdminBookingsList({ initial }: { initial: AdminBooking[] }) {
  const { t } = useLanguage()
  const [rows, setRows] = useState(initial)
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select(SELECT_QUERY)
      .order('booking_date', { ascending: false })
      .limit(200)
    if (data) setRows((data as RawRow[]).map(parseRow))
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('admin-bookings-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        async (payload) => {
          const newId = (payload.new as { id: string }).id
          const { data } = await supabase
            .from('bookings')
            .select(SELECT_QUERY)
            .eq('id', newId)
            .single()
          if (data) {
            const booking = parseRow(data as RawRow)
            setRows((prev) => {
              // Maintain booking_date descending order
              const idx = prev.findIndex((b) => b.booking_date <= booking.booking_date)
              if (idx === -1) return [...prev, booking]
              return [...prev.slice(0, idx), booking, ...prev.slice(idx)]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          const u = payload.new as { id: string; status: string; deposit_received: boolean }
          setRows((prev) =>
            prev.map((b) =>
              b.id === u.id
                ? { ...b, status: u.status as BookingStatus, deposit_received: u.deposit_received }
                : b
            )
          )
        }
      )
      .subscribe()

    const timer = setInterval(fetchAll, POLL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchAll])

  async function act(id: string, action: 'confirm' | 'unconfirm' | 'cancel' | 'close') {
    setBusy(id)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (res.ok) {
        setRows((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: json.status as BookingStatus,
                  deposit_received: action === 'confirm' ? true : action === 'unconfirm' ? false : b.deposit_received,
                }
              : b
          )
        )
      }
    } finally {
      setBusy(null)
    }
  }

  const counts = rows.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1
    return acc
  }, {})
  const visible = filter === 'all' ? rows : rows.filter((b) => b.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTER_KEYS.map((f) => {
          const n = f.k === 'all' ? rows.length : counts[f.k] ?? 0
          return (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f.k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t(f.labelKey as never)} · {n}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">{t('booking.admin.noBookings')}</p>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl bg-white p-4 shadow-sm"
              style={b.override_request && b.status === 'pending' ? { borderLeft: '3px solid #f59e0b' } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{b.customer?.username ?? 'Unknown'}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <Phone className="h-3 w-3" /> {b.customer?.phone ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {b.override_request && b.status === 'pending' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      {t('booking.admin.overrideBadge')}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle[b.status]}`}>
                    {t(statusKey[b.status] as never)}
                  </span>
                </div>
              </div>

              {b.override_request && b.status === 'pending' && (
                <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>{t('booking.admin.overrideWarning')}</span>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                <span className="font-medium text-gray-800">{formatDate(b.booking_date)}</span>
                <span className="flex items-center gap-1 font-mono text-xs text-gray-500">
                  <Clock className="h-3 w-3" /> {timeLabel(b.hours)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span className="font-mono">{b.ref}</span>
                <span>
                  {t('booking.admin.depositLabel')} <strong className="text-gray-800">{b.deposit_total.toLocaleString('en-US')} MMK</strong>
                </span>
              </div>

              {b.status !== 'cancelled' && b.status !== 'closed' && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => act(b.id, b.deposit_received ? 'unconfirm' : 'confirm')}
                    disabled={busy === b.id}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
                      b.deposit_received
                        ? 'bg-primary text-white hover:bg-primary-dark'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {b.deposit_received ? t('booking.admin.depositReceived') : t('booking.admin.confirmDeposit')}
                  </button>
                  <button
                    onClick={() => act(b.id, 'cancel')}
                    disabled={busy === b.id}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" /> {t('booking.admin.cancelBooking')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}