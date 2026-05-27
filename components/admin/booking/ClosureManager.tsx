'use client'

import { useState } from 'react'
import { Trash2, Plus, CalendarOff } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { dayHours } from '@/lib/booking'

export type Closure = {
  id: string
  closure_date: string
  hour_start: number | null
  reason: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function ClosureManager({ initial }: { initial: Closure[] }) {
  const [rows, setRows] = useState(initial)
  const [date, setDate] = useState('')
  const [hour, setHour] = useState<string>('') // '' = whole day
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closure_date: date,
          hour_start: hour === '' ? null : Number(hour),
          reason: reason || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to add closure.')
        return
      }
      setRows((prev) => [json, ...prev])
      setReason('')
      setHour('')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/closures?id=${id}`, { method: 'DELETE' })
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">Slot</span>
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Whole day</option>
              {dayHours().map((h) => (
                <option key={h} value={h}>
                  {pad(h)}:00 – {pad(h + 1)}:00
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Reason</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Event, maintenance…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !date}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Close date / slot
        </button>
      </form>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">No closures.</p>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <CalendarOff className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(c.closure_date)}</p>
                  <p className="text-xs text-gray-400">
                    {c.hour_start == null ? 'Whole day' : `${pad(c.hour_start)}:00 – ${pad(c.hour_start + 1)}:00`}
                    {c.reason ? ` · ${c.reason}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => remove(c.id)}
                disabled={busy}
                className="rounded-lg border border-gray-300 p-2 text-red-600 hover:bg-red-50"
                aria-label="Remove closure"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
