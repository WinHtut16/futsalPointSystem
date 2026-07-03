'use client'

import { useState, useEffect, useMemo } from 'react'
import { Trash2, Plus, CalendarOff } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { dayHours } from '@/lib/booking'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import ConfirmModal from '@/components/ui/ConfirmModal'

export type Closure = {
  id: string
  closure_date: string
  hour_start: number | null
  reason: string | null
}

const COURT_NAME = 'MyaThida Court'
const pad = (n: number) => String(n).padStart(2, '0')

export default function ClosureManager({ initial, today }: { initial: Closure[]; today: string }) {
  const { t } = useLanguage()
  const [rows, setRows] = useState(initial)
  const [date, setDate] = useState('')
  const [hour, setHour] = useState<string>('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Closure | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  const hasPast = useMemo(() => rows.some((r) => r.closure_date < today), [rows, today])

  const visible = useMemo(() => {
    const future = rows
      .filter((r) => r.closure_date >= today)
      .sort((a, b) => a.closure_date.localeCompare(b.closure_date))
    if (!showPast) return future
    const past = rows
      .filter((r) => r.closure_date < today)
      .sort((a, b) => b.closure_date.localeCompare(a.closure_date))
    return [...future, ...past]
  }, [rows, today, showPast])

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

  async function doDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/closures?id=${pendingDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== pendingDelete.id))
        setPendingDelete(null)
        setToast(t('booking.admin.slotReopened'))
      }
    } finally {
      setDeleting(false)
    }
  }

  function slotLabel(c: Closure) {
    return c.hour_start == null
      ? t('booking.admin.wholeDay')
      : `${pad(c.hour_start)}:00 – ${pad(c.hour_start + 1)}:00`
  }

  const modalBody = pendingDelete
    ? pendingDelete.closure_date < today
      ? t('booking.admin.reopenSlotPastBody', {
          court: COURT_NAME,
          date: formatDate(pendingDelete.closure_date),
        })
      : t('booking.admin.reopenSlotFutureBody', {
          court: COURT_NAME,
          date: formatDate(pendingDelete.closure_date),
          slot: slotLabel(pendingDelete),
        })
    : ''

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="space-y-3 overflow-hidden rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2">
          <label className="block w-full min-w-0 overflow-hidden">
            <span className="mb-1 block text-xs font-semibold text-gray-600">{t('booking.admin.closureDate')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">{t('booking.admin.slotLabel')}</span>
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">{t('booking.admin.wholeDay')}</option>
              {dayHours().map((h) => (
                <option key={h} value={h}>
                  {pad(h)}:00 – {pad(h + 1)}:00
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">{t('booking.admin.reason')}</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('booking.admin.closurePlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !date}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {t('booking.admin.saveClosureBtn')}
        </button>
      </form>

      <div className="space-y-2">
        {hasPast && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowPast((p) => !p)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {showPast ? t('booking.admin.hidePastClosures') : t('booking.admin.showPastClosures')}
            </button>
          </div>
        )}
        {visible.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">{t('booking.admin.noClosures')}</p>
        ) : (
          visible.map((c) => {
            const isPast = c.closure_date < today
            return (
              <div
                key={c.id}
                className={cn(
                  'flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm',
                  isPast && 'opacity-60',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                    <CalendarOff className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm font-semibold text-gray-900', isPast && 'italic text-gray-400')}>
                        {formatDate(c.closure_date)}
                      </p>
                      {isPast && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
                          {t('booking.admin.pastLabel')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {slotLabel(c)}
                      {c.reason ? ` · ${c.reason}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPendingDelete(c)}
                  disabled={busy}
                  className="rounded-lg border border-gray-300 p-2 text-red-600 hover:bg-red-50"
                  aria-label={t('booking.admin.removeClosure')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <ConfirmModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={doDelete}
        title={t('booking.admin.reopenSlotTitle')}
        message={modalBody}
        confirmLabel={t('booking.admin.reopenSlotConfirm')}
        cancelLabel={t('booking.admin.cancel')}
        variant="warning"
        isLoading={deleting}
      />

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg"
          style={{ background: 'var(--color-primary)' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
