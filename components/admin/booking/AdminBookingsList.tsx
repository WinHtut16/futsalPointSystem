'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Phone, Clock, AlertTriangle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
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
  updated_at: string
  customer: { username: string | null; phone: string | null } | null
  hours: number[]
}

const SELECT_QUERY =
  'id, ref, status, booking_date, deposit_total, deposit_received, override_request, updated_at, customer:profiles(username, phone), booking_slots(hour_start)'

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
    updated_at: (b.updated_at as string) ?? new Date(0).toISOString(),
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

interface AdminBookingsListProps {
  initial: AdminBooking[]
  total: number
  page: number
  totalPages: number
  pageSize: number
  currentStatus: string
  currentSearch: string
  currentFrom: string
  currentTo: string
}

export default function AdminBookingsList({
  initial,
  total,
  page,
  totalPages,
  pageSize,
  currentStatus,
  currentSearch,
  currentFrom,
  currentTo,
}: AdminBookingsListProps) {
  const { t } = useLanguage()
  const router = useRouter()

  const [rows, setRows] = useState(initial)
  const [busyMap, setBusyMap] = useState<Record<string, string>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({})
  const [hasNewBookings, setHasNewBookings] = useState(false)

  // Local controlled values for search / date inputs (debounced push to URL)
  const [searchInput, setSearchInput] = useState(currentSearch)
  const [fromInput, setFromInput] = useState(currentFrom)
  const [toInput, setToInput] = useState(currentTo)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset local state when server props change (new navigation)
  useEffect(() => {
    setRows(initial)
    setHasNewBookings(false)
  }, [initial])

  useEffect(() => { setSearchInput(currentSearch) }, [currentSearch])
  useEffect(() => { setFromInput(currentFrom) }, [currentFrom])
  useEffect(() => { setToInput(currentTo) }, [currentTo])

  // Build URL with updated params, always resetting page to 1 on filter change.
  function buildUrl(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      status: currentStatus,
      search: currentSearch,
      from: currentFrom,
      to: currentTo,
      page: '1',
      ...overrides,
    }
    const p = new URLSearchParams()
    if (merged.status && merged.status !== 'all') p.set('status', merged.status)
    if (merged.search) p.set('search', merged.search)
    if (merged.from) p.set('from', merged.from)
    if (merged.to) p.set('to', merged.to)
    if (merged.page && merged.page !== '1') p.set('page', merged.page)
    const qs = p.toString()
    return `/admin/bookings${qs ? `?${qs}` : ''}`
  }

  function navigate(overrides: Record<string, string>) {
    router.push(buildUrl(overrides))
  }

  function handleStatusFilter(k: string) {
    navigate({ status: k, page: '1' })
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      navigate({ search: value, page: '1' })
    }, 400)
  }

  function handleFromChange(value: string) {
    setFromInput(value)
    navigate({ from: value, page: '1' })
  }

  function handleToChange(value: string) {
    setToInput(value)
    navigate({ to: value, page: '1' })
  }

  function handleClearFilters() {
    setSearchInput('')
    setFromInput('')
    setToInput('')
    router.push('/admin/bookings')
  }

  function handlePageChange(newPage: number) {
    navigate({ page: String(newPage) })
  }

  const hasFilters = currentSearch || currentFrom || currentTo || (currentStatus && currentStatus !== 'all')

  // Real-time subscription: patch in-place for updates, prepend for inserts.
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
            // Only prepend if on page 1 and matches current status filter.
            const matchesFilter =
              currentStatus === 'all' || booking.status === currentStatus
            if (page === 1 && matchesFilter) {
              setRows((prev) => {
                const idx = prev.findIndex((b) => b.booking_date <= booking.booking_date)
                if (idx === -1) return [...prev, booking]
                return [...prev.slice(0, idx), booking, ...prev.slice(idx)]
              })
            } else if (matchesFilter) {
              setHasNewBookings(true)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          const u = payload.new as { id: string; status: string; deposit_received: boolean; updated_at: string }
          setRows((prev) =>
            prev.map((b) => {
              if (b.id !== u.id) return b
              // Discard stale out-of-order events.
              const incomingTime = new Date(u.updated_at).getTime()
              const currentTime  = new Date(b.updated_at).getTime()
              if (incomingTime < currentTime) return b
              return { ...b, status: u.status as BookingStatus, deposit_received: u.deposit_received, updated_at: u.updated_at }
            })
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentStatus, page])

  async function act(id: string, action: 'confirm' | 'unconfirm' | 'cancel' | 'close') {
    setBusyMap((prev) => ({ ...prev, [id]: action }))
    setErrorMap((prev) => ({ ...prev, [id]: null }))
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
                  deposit_received:
                    action === 'confirm' ? true : action === 'unconfirm' ? false : b.deposit_received,
                }
              : b
          )
        )
      } else {
        setErrorMap((prev) => ({ ...prev, [id]: json.error ?? t('booking.admin.actionFailed') }))
      }
    } catch {
      setErrorMap((prev) => ({ ...prev, [id]: t('booking.admin.actionFailed') }))
    } finally {
      setBusyMap((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  const fromIdx = (page - 1) * pageSize + 1
  const toIdx = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_KEYS.map((f) => (
          <button
            key={f.k}
            onClick={() => handleStatusFilter(f.k)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              currentStatus === f.k || (f.k === 'all' && (!currentStatus || currentStatus === 'all'))
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(f.labelKey as never)}
          </button>
        ))}
      </div>

      {/* Search + date range row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('booking.admin.searchPlaceholder' as never)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {t('booking.admin.dateFrom' as never)}
            </label>
            <input
              type="date"
              value={fromInput}
              onChange={(e) => handleFromChange(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="mt-4 text-gray-400">–</div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {t('booking.admin.dateTo' as never)}
            </label>
            <input
              type="date"
              value={toInput}
              onChange={(e) => handleToChange(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50"
          >
            {t('booking.admin.clearFilters' as never)}
          </button>
        )}
      </div>

      {/* New bookings banner (when on page > 1 and insert arrived) */}
      {hasNewBookings && (
        <button
          onClick={() => navigate({ page: '1' })}
          className="w-full rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          {t('booking.admin.newOnThisPage' as never)} — click to go to page 1
        </button>
      )}

      {/* Count + pagination info */}
      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {t('booking.admin.showing' as never, { from: String(fromIdx), to: String(toIdx), total: String(total) })}
          </span>
          <span>{t('booking.admin.pageOf' as never, { page: String(page), total: String(totalPages) })}</span>
        </div>
      )}

      {/* Bookings list */}
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          {t('booking.admin.noBookings')}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl bg-white p-4 shadow-sm"
              style={
                b.override_request && b.status === 'pending'
                  ? { borderLeft: '3px solid #f59e0b' }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">
                    {b.customer?.username ?? 'Unknown'}
                  </p>
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
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle[b.status]}`}
                  >
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
                  {t('booking.admin.depositLabel')}{' '}
                  <strong className="text-gray-800">
                    {b.deposit_total.toLocaleString('en-US')} MMK
                  </strong>
                </span>
              </div>

              {b.status !== 'cancelled' && b.status !== 'closed' && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => act(b.id, b.deposit_received ? 'unconfirm' : 'confirm')}
                      disabled={!!busyMap[b.id]}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
                        b.deposit_received
                          ? 'bg-primary text-white hover:bg-primary-dark'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      } ${
                        !!busyMap[b.id] &&
                        busyMap[b.id] !== 'confirm' &&
                        busyMap[b.id] !== 'unconfirm'
                          ? 'opacity-50'
                          : ''
                      }`}
                    >
                      {busyMap[b.id] === 'confirm' || busyMap[b.id] === 'unconfirm' ? (
                        <>
                          <svg
                            className="h-3.5 w-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="3"
                              className="opacity-25"
                            />
                            <path
                              fill="currentColor"
                              className="opacity-75"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          {b.deposit_received
                            ? t('booking.admin.receiving')
                            : t('booking.admin.confirming')}
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          {b.deposit_received
                            ? t('booking.admin.depositReceived')
                            : t('booking.admin.confirmDeposit')}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => act(b.id, 'cancel')}
                      disabled={!!busyMap[b.id]}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 ${
                        !!busyMap[b.id] && busyMap[b.id] !== 'cancel' ? 'opacity-50' : ''
                      }`}
                    >
                      {busyMap[b.id] === 'cancel' ? (
                        <>
                          <svg
                            className="h-3.5 w-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="3"
                              className="opacity-25"
                            />
                            <path
                              fill="currentColor"
                              className="opacity-75"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          {t('booking.admin.cancelling')}
                        </>
                      ) : (
                        <>
                          <X className="h-3.5 w-3.5" /> {t('booking.admin.cancelBooking')}
                        </>
                      )}
                    </button>
                  </div>
                  {errorMap[b.id] && (
                    <p className="text-xs text-red-500">{errorMap[b.id]}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('booking.admin.prevPage' as never)}
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p2: number
              if (totalPages <= 7) {
                p2 = i + 1
              } else if (page <= 4) {
                p2 = i < 5 ? i + 1 : i === 5 ? -1 : totalPages
              } else if (page >= totalPages - 3) {
                p2 = i === 0 ? 1 : i === 1 ? -1 : totalPages - 6 + i
              } else {
                p2 = i === 0 ? 1 : i === 1 ? -1 : i === 5 ? -1 : i === 6 ? totalPages : page + i - 3
              }
              if (p2 === -1) {
                return (
                  <span key={`ellipsis-${i}`} className="px-1 text-gray-400">
                    …
                  </span>
                )
              }
              return (
                <button
                  key={p2}
                  onClick={() => handlePageChange(p2)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    p2 === page
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p2}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('booking.admin.nextPage' as never)}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
