'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Phone, Clock, AlertTriangle, Search, ChevronLeft, ChevronRight, Plus, ChevronDown, Archive, Trash2, RotateCcw } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import ConfirmModal from '@/components/ui/ConfirmModal'
import AdminNewBookingPanel from './AdminNewBookingPanel'
import type { UserRole } from '@/types'

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
  source: 'online' | 'phone' | 'walk_in' | 'other' | null
  guest_name: string | null
  guest_phone: string | null
  internal_notes: string | null
  is_archived: boolean
}

const SELECT_QUERY =
  'id, ref, status, booking_date, deposit_total, deposit_received, override_request, updated_at, source, guest_name, guest_phone, internal_notes, customer:profiles(username, phone), booking_slots(hour_start)'

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
    source: (b.source as AdminBooking['source']) ?? null,
    guest_name: (b.guest_name as string | null) ?? null,
    guest_phone: (b.guest_phone as string | null) ?? null,
    internal_notes: (b.internal_notes as string | null) ?? null,
    is_archived: (b.is_archived as boolean) ?? false,
  }
}

type TabFilter = 'all' | 'pending' | 'confirmed' | 'history'

const FILTER_KEYS: { k: TabFilter; labelKey: string }[] = [
  { k: 'all', labelKey: 'booking.admin.all' },
  { k: 'pending', labelKey: 'booking.status.pending' },
  { k: 'confirmed', labelKey: 'booking.status.confirmed' },
  { k: 'history', labelKey: 'booking.admin.history' },
]

const HISTORY_SUB_FILTERS: { k: string; labelKey: string }[] = [
  { k: 'all', labelKey: 'booking.admin.historySubAll' },
  { k: 'cancelled', labelKey: 'booking.admin.historySubCancelled' },
  { k: 'closed', labelKey: 'booking.admin.historySubNoshow' },
]

function getMyanmarToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(new Date())
}
function getMyanmarTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(d)
}

function dateGroupLabel(bookingDate: string, todayMM: string, tomorrowMM: string): string {
  const [y, m, day] = bookingDate.split('-').map(Number)
  const monthDay = new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (bookingDate === todayMM) return `TODAY  •  ${monthDay}`
  if (bookingDate === tomorrowMM) return `Tomorrow  •  ${monthDay}`
  return monthDay
}

function relTimeLabel(bookingDate: string, hours: number[], todayMM: string, tomorrowMM: string): string | null {
  if (bookingDate < todayMM) return null
  if (bookingDate === tomorrowMM) return 'Tomorrow'
  if (bookingDate > tomorrowMM) {
    const [y1, m1, d1] = todayMM.split('-').map(Number)
    const [y2, m2, d2] = bookingDate.split('-').map(Number)
    const diff = Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000)
    return `in ${diff} day${diff !== 1 ? 's' : ''}`
  }
  if (hours.length === 0) return 'Today'
  const earliest = Math.min(...hours)
  const nowH = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Yangon', hour: 'numeric', hour12: false }).format(new Date()),
    10
  )
  const diff = earliest - nowH
  if (diff <= 0) return 'Today'
  return `Today · in ${diff} hr${diff !== 1 ? 's' : ''}`
}

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

const sourceStyle: Record<NonNullable<AdminBooking['source']>, string> = {
  online: 'bg-blue-100 text-blue-700',
  phone: 'bg-purple-100 text-purple-700',
  walk_in: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
}

const sourceLabel: Record<NonNullable<AdminBooking['source']>, string> = {
  online: 'Online',
  phone: 'Phone',
  walk_in: 'Walk-in',
  other: 'Other',
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-600', 'bg-violet-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const pad = (n: number) => String(n).padStart(2, '0')

function timeLabel(hours: number[]) {
  if (hours.length === 0) return '—'
  const sorted = [...hours].sort((a, b) => a - b)
  return `${pad(sorted[0])}:00 – ${pad(sorted[sorted.length - 1] + 1)}:00`
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

interface BookingStats {
  bookingsThisWeek: number
  depositsThisWeek: number
  pendingCount: number
  totalCustomers: number
}

interface AdminBookingsListProps {
  initial: AdminBooking[]
  total: number
  page: number
  totalPages: number
  pageSize: number
  currentStatus: string
  currentSub: string
  currentSearch: string
  currentFrom: string
  currentTo: string
  stats: BookingStats
  role: UserRole
}

const PURGE_OPTIONS: { days: number; labelKey: string }[] = [
  { days: 30, labelKey: 'booking.admin.purge30d' },
  { days: 90, labelKey: 'booking.admin.purge90d' },
  { days: 180, labelKey: 'booking.admin.purge6m' },
  { days: 365, labelKey: 'booking.admin.purge1y' },
]

export default function AdminBookingsList({
  initial,
  total,
  page,
  totalPages,
  pageSize,
  currentStatus,
  currentSub,
  currentSearch,
  currentFrom,
  currentTo,
  stats,
  role,
}: AdminBookingsListProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const todayMM = getMyanmarToday()
  const tomorrowMM = getMyanmarTomorrow()
  const isSuperAdmin = role === 'superadmin'
  const isHistory = currentStatus === 'history'

  const [rows, setRows] = useState(initial)
  const [busyMap, setBusyMap] = useState<Record<string, string>>({})
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({})
  const [hasNewBookings, setHasNewBookings] = useState(false)
  const [localExtraCount, setLocalExtraCount] = useState(0)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  // Selection state (History tab only)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState<string | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [hardDeleteConfirmOpen, setHardDeleteConfirmOpen] = useState(false)

  // Purge state (superadmin only)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeDays, setPurgeDays] = useState<number>(30)
  const [purgeCount, setPurgeCount] = useState<number | null>(null)
  const [purgeCountLoading, setPurgeCountLoading] = useState(false)
  const [purgeBusy, setPurgeBusy] = useState(false)

  function toggleNotes(id: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (prev.size === rows.length) return new Set()
      return new Set(rows.map((r) => r.id))
    })
  }

  async function bulkAction(endpoint: string, extraBody?: Record<string, unknown>) {
    const ids = Array.from(selected)
    if (!ids.length) return
    setBulkBusy(endpoint)
    try {
      const res = await fetch(`/api/admin/bookings/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, ...extraBody }),
      })
      if (res.ok) {
        if (endpoint === 'hard-delete') {
          setRows((prev) => prev.filter((r) => !ids.includes(r.id)))
        } else if (endpoint === 'archive') {
          setRows((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, is_archived: true } : r))
        } else if (endpoint === 'restore') {
          setRows((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, is_archived: false } : r))
        }
        setSelected(new Set())
      }
    } finally {
      setBulkBusy(null)
    }
  }

  // Fetch purge count when purge modal opens or days changes.
  useEffect(() => {
    if (!purgeOpen) { setPurgeCount(null); return }
    setPurgeCountLoading(true)
    fetch(`/api/admin/bookings/purge?olderThanDays=${purgeDays}`)
      .then((r) => r.json())
      .then((d) => setPurgeCount(d.count ?? 0))
      .catch(() => setPurgeCount(null))
      .finally(() => setPurgeCountLoading(false))
  }, [purgeOpen, purgeDays])

  async function executePurge() {
    setPurgeBusy(true)
    try {
      const res = await fetch('/api/admin/bookings/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays: purgeDays }),
      })
      if (res.ok) { setPurgeOpen(false); router.refresh() }
    } finally {
      setPurgeBusy(false)
    }
  }

  function handleBookingCreated(ref: string, hadConflict: boolean) {
    const msg = hadConflict
      ? `Booking ${ref} created — pending conflict, confirm from list to resolve.`
      : `Booking ${ref} created.`
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 5000)
  }

  const currentStatusRef = useRef(currentStatus)
  useEffect(() => { currentStatusRef.current = currentStatus }, [currentStatus])

  const [searchInput, setSearchInput] = useState(currentSearch)
  const [fromInput, setFromInput] = useState(currentFrom)
  const [toInput, setToInput] = useState(currentTo)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setRows(initial)
    setHasNewBookings(false)
    setLocalExtraCount(0)
    setSelected(new Set())
  }, [initial])

  useEffect(() => { setSearchInput(currentSearch) }, [currentSearch])
  useEffect(() => { setFromInput(currentFrom) }, [currentFrom])
  useEffect(() => { setToInput(currentTo) }, [currentTo])

  function buildUrl(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      status: currentStatus,
      sub: currentSub,
      search: currentSearch,
      from: currentFrom,
      to: currentTo,
      page: '1',
      ...overrides,
    }
    // Switching away from History clears the sub-filter
    if (merged.status !== 'history') merged.sub = 'all'
    const p = new URLSearchParams()
    if (merged.status && merged.status !== 'pending') p.set('status', merged.status)
    if (merged.sub && merged.sub !== 'all') p.set('sub', merged.sub)
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

  const hasFilters = currentSearch || currentFrom || currentTo || (currentStatus && currentStatus !== 'pending')

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('admin-bookings-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        async (payload) => {
          try {
            if (currentStatusRef.current === 'history') return
            const newId = (payload.new as { id: string }).id
            const { data } = await supabase
              .from('bookings')
              .select(SELECT_QUERY)
              .eq('id', newId)
              .single()
            if (data) {
              const booking = parseRow(data as RawRow)
              if (booking.booking_date < todayMM) return
              const matchesFilter =
                currentStatusRef.current === 'all' || booking.status === currentStatusRef.current
              if (page === 1 && matchesFilter) {
                setRows((prev) => {
                  const idx = prev.findIndex((b) => b.booking_date > booking.booking_date)
                  if (idx === -1) return [...prev, booking]
                  return [...prev.slice(0, idx), booking, ...prev.slice(idx)]
                })
                setLocalExtraCount((c) => c + 1)
              } else if (matchesFilter) {
                setHasNewBookings(true)
              }
            }
          } catch (err) {
            console.error('[admin-bookings-list] INSERT handler error:', err)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          try {
            const u = payload.new as { id: string; status: string; deposit_received: boolean; updated_at: string }
            setRows((prev) => {
              const activeStatus = currentStatusRef.current
              if (activeStatus !== 'all' && activeStatus !== 'history' && u.status !== activeStatus) {
                return prev.filter((b) => b.id !== u.id)
              }
              return prev.map((b) => {
                if (b.id !== u.id) return b
                const incomingTime = new Date(u.updated_at).getTime()
                const currentTime = new Date(b.updated_at).getTime()
                if (incomingTime < currentTime) return b
                return { ...b, status: u.status as BookingStatus, deposit_received: u.deposit_received, updated_at: u.updated_at }
              })
            })
          } catch (err) {
            console.error('[admin-bookings-list] UPDATE handler error:', err)
          }
        }
      )
      .subscribe()

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        router.refresh()
      }
    })

    return () => { supabase.removeChannel(channel) }
  }, [currentStatus, page, router])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => { document.removeEventListener('visibilitychange', handleVisibilityChange) }
  }, [])

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
        const newStatus = json.status as BookingStatus
        setRows((prev) => {
          if (currentStatusRef.current !== 'all' && newStatus !== currentStatusRef.current) {
            return prev.filter((b) => b.id !== id)
          }
          return prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: newStatus,
                  deposit_received:
                    action === 'confirm' ? true : action === 'unconfirm' ? false : b.deposit_received,
                }
              : b
          )
        })
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

  const displayTotal = total + localExtraCount
  const fromIdx = (page - 1) * pageSize + 1
  const toIdx = Math.min(page * pageSize + localExtraCount, displayTotal)

  const statItems = [
    { label: t('booking.admin.statBookingsWeek' as never), value: stats.bookingsThisWeek },
    {
      label: t('booking.admin.statDepositsWeek' as never),
      value: stats.depositsThisWeek > 0
        ? `${stats.depositsThisWeek.toLocaleString('en-US')} MMK`
        : '0 MMK',
    },
    { label: t('booking.admin.statPending' as never), value: stats.pendingCount },
    { label: t('booking.admin.statCustomers' as never), value: stats.totalCustomers },
  ]

  return (
    <div className="space-y-4">
      {/* New Booking + Purge button row */}
      <div className="flex items-center justify-between gap-2">
        {isSuperAdmin && isHistory ? (
          <button
            onClick={() => setPurgeOpen(true)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50"
          >
            {t('booking.admin.purgeOldRecords' as never)}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={() => setIsPanelOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          {t('booking.admin.newBooking' as never)}
        </button>
      </div>

      {/* Floating bulk-action toolbar (History tab only) */}
      {isHistory && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
          <span className="mr-1 font-semibold">
            {t('booking.admin.selectedCount' as never, { n: String(selected.size) })}
          </span>
          <button
            disabled={!!bulkBusy}
            onClick={() => setArchiveConfirmOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" />
            {t('booking.admin.archiveSelected' as never)}
          </button>
          {isSuperAdmin && (
            <>
              <button
                disabled={!!bulkBusy}
                onClick={() => bulkAction('restore')}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('booking.admin.restoreSelected' as never)}
              </button>
              <button
                disabled={!!bulkBusy}
                onClick={() => setHardDeleteConfirmOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('booking.admin.hardDeleteSelected' as never)}
              </button>
            </>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-white/60 hover:text-white"
          >
            {t('booking.admin.clearSelection' as never)}
          </button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800">
          {successMsg}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statItems.map(({ label, value }) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_KEYS.map((f) => (
          <button
            key={f.k}
            onClick={() => handleStatusFilter(f.k)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              currentStatus === f.k
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t(f.labelKey as never)}
          </button>
        ))}
      </div>

      {/* History sub-filter pills */}
      {isHistory && (
        <div className="flex gap-1.5 mt-2">
          {HISTORY_SUB_FILTERS.map((f) => (
            <button
              key={f.k}
              onClick={() => navigate({ sub: f.k })}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                currentSub === f.k
                  ? 'border-2 border-gray-900 bg-white text-gray-900 font-semibold'
                  : 'border border-gray-300 bg-transparent text-gray-500 font-normal hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              {t(f.labelKey as never)}
            </button>
          ))}
        </div>
      )}

      {/* Search + date range */}
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

      {hasNewBookings && (
        <button
          onClick={() => navigate({ page: '1' })}
          className="w-full rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          {t('booking.admin.newOnThisPage' as never)} — click to go to page 1
        </button>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {t('booking.admin.showing' as never, { from: String(fromIdx), to: String(toIdx), total: String(displayTotal) })}
          </span>
          <span>{t('booking.admin.pageOf' as never, { page: String(page), total: String(totalPages) })}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">
          {t('booking.admin.noBookings')}
        </p>
      ) : (
        <>
          {/* ── Desktop table (md+) ─────────────────────────────────────── */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {isHistory && (
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selected.size === rows.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-primary"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t('booking.admin.customer')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t('booking.admin.dateSlots')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t('booking.admin.statusCol')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t('booking.admin.depositLabel')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t('booking.admin.received')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {t('booking.admin.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((b, idx) => {
                  const prev = rows[idx - 1]
                  const isNewGroup = !prev || prev.booking_date !== b.booking_date
                  const isPast = b.booking_date < todayMM
                  const muted = b.status === 'cancelled' || b.status === 'closed' || isPast
                  const badgeStyle = isPast
                    ? 'bg-gray-100 text-gray-500'
                    : statusStyle[b.status]
                  const displayName = b.customer?.username ?? b.guest_name ?? 'Guest'
                  const initials = displayName ? displayName.substring(0, 2).toUpperCase() : '??'
                  const isBusy = !!busyMap[b.id]
                  const relLabel = relTimeLabel(b.booking_date, b.hours, todayMM, tomorrowMM)
                  return (
                    <Fragment key={b.id}>
                      {isNewGroup && (
                        <tr>
                          <td colSpan={isHistory ? 7 : 6} className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                            {dateGroupLabel(b.booking_date, todayMM, tomorrowMM)}
                          </td>
                        </tr>
                      )}
                      <tr className={b.is_archived ? 'opacity-40' : muted ? 'opacity-50' : ''}>
                        {/* Checkbox (History tab) */}
                        {isHistory && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(b.id)}
                              onChange={() => toggleSelect(b.id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary"
                            />
                          </td>
                        )}
                        {/* Customer */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarColor(displayName)}`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">
                                {b.customer?.username ?? b.guest_name ?? 'Guest'}
                              </p>
                              <p className="truncate text-xs text-gray-400">
                                {b.customer?.phone ?? b.guest_phone ?? '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        {/* Date + Slots */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-800">{formatDate(b.booking_date)}</p>
                            {relLabel && (
                              <span className="text-[10px] text-gray-400">{relLabel}</span>
                            )}
                          </div>
                          <p className="font-mono text-xs text-gray-400">{timeLabel(b.hours)}</p>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeStyle}`}
                            >
                              {t(statusKey[b.status] as never)}
                            </span>
                            {b.is_archived && (
                              <span className="inline-block w-fit rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                                {t('booking.admin.archived' as never)}
                              </span>
                            )}
                            {b.override_request && b.status === 'pending' && (
                              <span className="inline-block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                {t('booking.admin.overrideBadge')}
                              </span>
                            )}
                            {b.source && (
                              <span className={`inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${sourceStyle[b.source]}`}>
                                {sourceLabel[b.source]}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Deposit */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-800">
                            {b.deposit_total.toLocaleString('en-US')} MMK
                          </span>
                        </td>
                        {/* Received toggle */}
                        <td className="px-4 py-3">
                          {!muted ? (
                            <button
                              onClick={() => act(b.id, b.deposit_received ? 'unconfirm' : 'confirm')}
                              disabled={isBusy}
                              role="switch"
                              aria-checked={b.deposit_received}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:cursor-wait ${
                                b.deposit_received ? 'bg-primary' : 'bg-gray-200'
                              }`}
                            >
                              {busyMap[b.id] === 'confirm' || busyMap[b.id] === 'unconfirm' ? (
                                <svg
                                  className="absolute left-1/2 h-3 w-3 -translate-x-1/2 animate-spin text-white"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                                  <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <span
                                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                    b.deposit_received ? 'translate-x-[18px]' : 'translate-x-0.5'
                                  }`}
                                />
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          {!muted && (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setCancelConfirmId(b.id)}
                                  disabled={isBusy}
                                  title={t('booking.admin.cancelBooking')}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-red-500 hover:bg-red-50 disabled:opacity-40"
                                >
                                  {busyMap[b.id] === 'cancel' ? (
                                    <Spinner />
                                  ) : (
                                    <X className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                {b.internal_notes && (
                                  <button
                                    onClick={() => toggleNotes(b.id)}
                                    title="Internal notes"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50"
                                  >
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 transition-transform ${expandedNotes.has(b.id) ? 'rotate-180' : ''}`}
                                    />
                                  </button>
                                )}
                              </div>
                              {errorMap[b.id] && (
                                <p className="text-[10px] text-red-500">{errorMap[b.id]}</p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedNotes.has(b.id) && b.internal_notes && (
                        <tr key={`${b.id}-notes`}>
                          <td colSpan={isHistory ? 7 : 6} className="bg-gray-50 px-4 pb-3 pt-0">
                            <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                              {b.internal_notes}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards (< md) ─────────────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {rows.map((b, idx) => {
              const prevRow = rows[idx - 1]
              const isNewGroup = !prevRow || prevRow.booking_date !== b.booking_date
              const isPast = b.booking_date < todayMM
              const badgeStyle = isPast ? 'bg-gray-100 text-gray-500' : statusStyle[b.status]
              const isActionable = b.status !== 'cancelled' && b.status !== 'closed' && !isPast
              const relLabel = relTimeLabel(b.booking_date, b.hours, todayMM, tomorrowMM)
              return (
              <Fragment key={b.id}>
              {isNewGroup && (
                <div className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {dateGroupLabel(b.booking_date, todayMM, tomorrowMM)}
                </div>
              )}
              <div
                className={`rounded-2xl bg-white p-4 shadow-sm${b.is_archived ? ' opacity-40' : isPast ? ' opacity-60' : ''}`}
                style={b.override_request && b.status === 'pending'
                  ? { borderLeft: '3px solid #f59e0b' }
                  : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    {isHistory && (
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        onChange={() => toggleSelect(b.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        {b.customer?.username ?? b.guest_name ?? 'Guest'}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone className="h-3 w-3" /> {b.customer?.phone ?? b.guest_phone ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {b.is_archived && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                        {t('booking.admin.archived' as never)}
                      </span>
                    )}
                    {b.override_request && b.status === 'pending' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        {t('booking.admin.overrideBadge')}
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeStyle}`}>
                      {t(statusKey[b.status] as never)}
                    </span>
                    {b.source && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sourceStyle[b.source]}`}>
                        {sourceLabel[b.source]}
                      </span>
                    )}
                  </div>
                </div>

                {b.override_request && b.status === 'pending' && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{t('booking.admin.overrideWarning')}</span>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-800">{formatDate(b.booking_date)}</span>
                    {relLabel && (
                      <span className="text-[10px] text-gray-400">{relLabel}</span>
                    )}
                  </div>
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

                {isActionable && (
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
                          !!busyMap[b.id] && busyMap[b.id] !== 'confirm' && busyMap[b.id] !== 'unconfirm'
                            ? 'opacity-50'
                            : ''
                        }`}
                      >
                        {busyMap[b.id] === 'confirm' || busyMap[b.id] === 'unconfirm' ? (
                          <><Spinner />{b.deposit_received ? t('booking.admin.receiving') : t('booking.admin.confirming')}</>
                        ) : (
                          <><Check className="h-3.5 w-3.5" />{b.deposit_received ? t('booking.admin.depositReceived') : t('booking.admin.confirmDeposit')}</>
                        )}
                      </button>
                      <button
                        onClick={() => setCancelConfirmId(b.id)}
                        disabled={!!busyMap[b.id]}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 ${
                          !!busyMap[b.id] && busyMap[b.id] !== 'cancel' ? 'opacity-50' : ''
                        }`}
                      >
                        {busyMap[b.id] === 'cancel' ? (
                          <><Spinner />{t('booking.admin.cancelling')}</>
                        ) : (
                          <><X className="h-3.5 w-3.5" /> {t('booking.admin.cancelBooking')}</>
                        )}
                      </button>
                    </div>
                    {errorMap[b.id] && (
                      <p className="text-xs text-red-500">{errorMap[b.id]}</p>
                    )}
                  </div>
                )}

                {b.internal_notes && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <button onClick={() => toggleNotes(b.id)} className="flex items-center gap-1 text-xs text-gray-400">
                      <ChevronDown className={`h-3 w-3 transition-transform ${expandedNotes.has(b.id) ? 'rotate-180' : ''}`} />
                      {t('booking.admin.internalNotes' as never)}
                    </button>
                    {expandedNotes.has(b.id) && (
                      <p className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{b.internal_notes}</p>
                    )}
                  </div>
                )}
              </div>
              </Fragment>
              )
            })}
          </div>
        </>
      )}

      {/* Pagination */}
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
                    p2 === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
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

      <ConfirmModal
        isOpen={!!cancelConfirmId}
        onClose={() => setCancelConfirmId(null)}
        onConfirm={() => {
          if (cancelConfirmId) act(cancelConfirmId, 'cancel')
          setCancelConfirmId(null)
        }}
        title="Cancel booking"
        message="This will cancel the booking and notify the customer. This action cannot be reversed."
        confirmLabel={t('booking.admin.cancelBooking')}
        variant="warning"
        isLoading={!!cancelConfirmId && busyMap[cancelConfirmId] === 'cancel'}
      />

      {/* Archive confirmation */}
      <ConfirmModal
        isOpen={archiveConfirmOpen}
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={() => { setArchiveConfirmOpen(false); bulkAction('archive') }}
        title={t('booking.admin.archiveConfirmTitle' as never)}
        message={t('booking.admin.archiveConfirmBody' as never)}
        confirmLabel={t('booking.admin.archiveSelected' as never)}
        variant="warning"
        isLoading={bulkBusy === 'archive'}
      />

      {/* Hard-delete confirmation (superadmin) */}
      {isSuperAdmin && (
        <ConfirmModal
          isOpen={hardDeleteConfirmOpen}
          onClose={() => setHardDeleteConfirmOpen(false)}
          onConfirm={() => { setHardDeleteConfirmOpen(false); bulkAction('hard-delete') }}
          title={t('booking.admin.hardDeleteConfirmTitle' as never)}
          message={t('booking.admin.hardDeleteConfirmBody' as never, { n: String(selected.size) })}
          confirmLabel={t('booking.admin.hardDeleteSelected' as never)}
          variant="danger"
          isLoading={bulkBusy === 'hard-delete'}
        />
      )}

      {/* Purge modal (superadmin) */}
      {isSuperAdmin && purgeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-gray-900">
              {t('booking.admin.purgeModalTitle' as never)}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {t('booking.admin.purgeOlderThan' as never)}
            </p>
            <select
              value={purgeDays}
              onChange={(e) => setPurgeDays(Number(e.target.value))}
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {PURGE_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {t(o.labelKey as never)}
                </option>
              ))}
            </select>
            <p className="mt-3 min-h-[1.5rem] text-sm text-red-600">
              {purgeCountLoading
                ? t('booking.admin.purgeWarningLoading' as never)
                : purgeCount !== null
                  ? t('booking.admin.purgeWarning' as never, { count: String(purgeCount) })
                  : ''}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setPurgeOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t('booking.admin.cancel')}
              </button>
              <button
                onClick={executePurge}
                disabled={purgeBusy || purgeCountLoading || purgeCount === 0}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {purgeBusy ? '…' : t('booking.admin.confirmPurge' as never)}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminNewBookingPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onSuccess={handleBookingCreated}
      />
    </div>
  )
}
