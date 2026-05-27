'use client'

import { useState } from 'react'
import { Check, X, Phone, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'closed'

export type AdminBooking = {
  id: string
  ref: string
  status: BookingStatus
  booking_date: string
  deposit_total: number
  deposit_received: boolean
  customer: { username: string | null; phone: string | null } | null
  hours: number[]
}

const FILTERS: { k: 'all' | BookingStatus; label: string }[] = [
  { k: 'all', label: 'All' },
  { k: 'pending', label: 'Pending' },
  { k: 'confirmed', label: 'Confirmed' },
  { k: 'cancelled', label: 'Cancelled' },
  { k: 'closed', label: 'Closed' },
]

const statusStyle: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  closed: 'bg-gray-200 text-gray-600',
}

const pad = (n: number) => String(n).padStart(2, '0')

function timeLabel(hours: number[]) {
  if (hours.length === 0) return '—'
  const sorted = [...hours].sort((a, b) => a - b)
  return `${pad(sorted[0])}:00 – ${pad(sorted[sorted.length - 1] + 1)}:00`
}

export default function AdminBookingsList({ initial }: { initial: AdminBooking[] }) {
  const [rows, setRows] = useState(initial)
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const [busy, setBusy] = useState<string | null>(null)

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
        {FILTERS.map((f) => {
          const n = f.k === 'all' ? rows.length : counts[f.k] ?? 0
          return (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f.k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label} · {n}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">No bookings.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => (
            <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{b.customer?.username ?? 'Unknown'}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <Phone className="h-3 w-3" /> {b.customer?.phone ?? '—'}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${statusStyle[b.status]}`}>
                  {b.status}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                <span className="font-medium text-gray-800">{formatDate(b.booking_date)}</span>
                <span className="flex items-center gap-1 font-mono text-xs text-gray-500">
                  <Clock className="h-3 w-3" /> {timeLabel(b.hours)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span className="font-mono">{b.ref}</span>
                <span>
                  Deposit <strong className="text-gray-800">{b.deposit_total.toLocaleString('en-US')} MMK</strong>
                </span>
              </div>

              {b.status !== 'cancelled' && b.status !== 'closed' && (
                <div className="mt-3 flex items-center gap-2">
                  {/* Deposit received toggle = confirm */}
                  <button
                    onClick={() => act(b.id, b.deposit_received ? 'unconfirm' : 'confirm')}
                    disabled={busy === b.id}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
                      b.deposit_received
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {b.deposit_received ? 'Deposit received' : 'Mark deposit received'}
                  </button>
                  <button
                    onClick={() => act(b.id, 'cancel')}
                    disabled={busy === b.id}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
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
