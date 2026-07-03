'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CheckCircle2, XCircle, Ban, ShoppingBag, Trash2, Square, CheckSquare } from 'lucide-react'
import type { RedemptionRequest, RedemptionStatus } from '@/types'
import RedemptionRequestCard from './RedemptionRequestCard'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDateTime } from '@/lib/utils'
import ConfirmModal from '@/components/ui/ConfirmModal'

const POLL_MS = 20_000
const SELECT_QUERY =
  '*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone, total_points)'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function groupByMonth(items: RedemptionRequest[]): { key: string; label: string; items: RedemptionRequest[] }[] {
  const map = new Map<string, RedemptionRequest[]>()
  for (const item of items) {
    const ts = item.resolved_at ?? item.requested_at
    const d = new Date(ts)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const [year, month] = key.split('-')
      return { key, label: `${MONTH_NAMES[parseInt(month) - 1]} ${year}`, items }
    })
}

function StatusBadge({ status }: { status: RedemptionStatus }) {
  if (status === 'approved')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    )
  if (status === 'rejected')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" /> Declined
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      <Ban className="w-3 h-3" /> Cancelled
    </span>
  )
}

export default function RedemptionsList({
  initialRequests,
  initialHistory,
  isSuperAdmin = false,
}: {
  initialRequests: RedemptionRequest[]
  initialHistory: RedemptionRequest[]
  isSuperAdmin?: boolean
}) {
  const [requests, setRequests] = useState<RedemptionRequest[]>(initialRequests)
  const [history, setHistory] = useState<RedemptionRequest[]>(initialHistory)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmState, setConfirmState] = useState<{ ids: string[]; label: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  const fetchAll = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('redemption_requests')
      .select(SELECT_QUERY)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })
    if (data) setRequests(data as RedemptionRequest[])
  }, [])

  const handleResolved = useCallback((id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('redemptions-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'redemption_requests' },
        async (payload) => {
          try {
            if ((payload.new as { status: string }).status !== 'pending') return
            const { data } = await supabase
              .from('redemption_requests')
              .select(SELECT_QUERY)
              .eq('id', (payload.new as { id: string }).id)
              .single()
            if (data) setRequests((prev) => [...prev, data as RedemptionRequest])
          } catch (err) {
            console.error('[redemptions-list] INSERT handler error:', err)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'redemption_requests' },
        async (payload) => {
          try {
            const updated = payload.new as { id: string; status: string }
            if (updated.status !== 'pending') {
              setRequests((prev) => prev.filter((r) => r.id !== updated.id))
              const { data } = await supabase
                .from('redemption_requests')
                .select(SELECT_QUERY)
                .eq('id', updated.id)
                .single()
              if (data) {
                setHistory((prev) => {
                  const without = prev.filter((r) => r.id !== updated.id)
                  return [data as RedemptionRequest, ...without]
                })
              }
            }
          } catch (err) {
            console.error('[redemptions-list] UPDATE handler error:', err)
          }
        },
      )
      .subscribe()

    const timer = setInterval(fetchAll, POLL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchAll])

  const groups = useMemo(() => groupByMonth(history), [history])
  const allHistoryIds = useMemo(() => history.map((r) => r.id), [history])
  const allSelected = allHistoryIds.length > 0 && allHistoryIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allHistoryIds))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(ids: string[]) {
    const allIn = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allIn) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  function requestDelete(ids: string[], label: string) {
    setConfirmState({ ids, label })
  }

  async function confirmDelete() {
    if (!confirmState) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/redemptions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: confirmState.ids }),
      })
      if (!res.ok) throw new Error('Failed')
      const deletedIds = new Set(confirmState.ids)
      setHistory((prev) => prev.filter((r) => !deletedIds.has(r.id)))
      setSelected((prev) => {
        const next = new Set(prev)
        deletedIds.forEach((id) => next.delete(id))
        return next
      })
      setToast({ msg: `Deleted ${confirmState.ids.length} record${confirmState.ids.length !== 1 ? 's' : ''}`, ok: true })
    } catch {
      setToast({ msg: 'Delete failed. Please try again.', ok: false })
    } finally {
      setDeleting(false)
      setConfirmState(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending section */}
      {requests.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <h2 className="text-sm font-semibold text-gray-700">
              {t('admin.awaitingApproval')}
            </h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {requests.length}
            </span>
          </div>
          <div className="space-y-3">
            {requests.map((req) => (
              <RedemptionRequestCard key={req.id} request={req} onResolved={handleResolved} />
            ))}
          </div>
        </section>
      ) : (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">{t('admin.noPendingRedemptions')}</p>
          <p className="text-xs text-gray-400 mt-1">All caught up!</p>
        </div>
      )}

      {/* History section */}
      {history.length > 0 && (
        <section className="space-y-4">
          {/* History header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isSuperAdmin && (
                <button
                  onClick={toggleAll}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                >
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : <Square className="w-4 h-4" />
                  }
                </button>
              )}
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {t('admin.historySection')}
              </h2>
            </div>
            {isSuperAdmin && someSelected && (
              <button
                onClick={() => requestDelete(Array.from(selected), `${selected.size} selected record${selected.size !== 1 ? 's' : ''}`)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected ({selected.size})
              </button>
            )}
          </div>

          {/* Month groups */}
          <div className="space-y-5">
            {groups.map((group) => {
              const groupIds = group.items.map((r) => r.id)
              const groupAllSelected = groupIds.every((id) => selected.has(id))

              return (
                <div key={group.key} className="space-y-2">
                  {/* Month heading row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSuperAdmin && (
                        <button
                          onClick={() => toggleGroup(groupIds)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title={groupAllSelected ? 'Deselect month' : 'Select month'}
                        >
                          {groupAllSelected
                            ? <CheckSquare className="w-3.5 h-3.5 text-primary" />
                            : <Square className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {group.label}
                      </span>
                      <span className="text-xs text-gray-300">{group.items.length}</span>
                    </div>
                    {isSuperAdmin && (
                      <button
                        onClick={() => requestDelete(groupIds, `all ${group.items.length} records from ${group.label}`)}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded"
                        title={`Delete all ${group.label} records`}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete month
                      </button>
                    )}
                  </div>

                  {/* Rows for this month */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                    {group.items.map((req) => (
                      <div key={req.id} className="flex items-center gap-3 px-4 py-3">
                        {isSuperAdmin && (
                          <button
                            onClick={() => toggleOne(req.id)}
                            className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                          >
                            {selected.has(req.id)
                              ? <CheckSquare className="w-4 h-4 text-primary" />
                              : <Square className="w-4 h-4" />
                            }
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {req.customer?.username}
                            </p>
                            <StatusBadge status={req.status} />
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{req.reward?.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-gray-700">
                            {req.reward?.points_cost} pts
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {req.resolved_at
                              ? formatDateTime(req.resolved_at)
                              : formatDateTime(req.requested_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {history.length === 0 && requests.length === 0 && (
        <p className="text-center text-xs text-gray-400 pb-4">{t('admin.noHistory')}</p>
      )}

      {/* Confirm delete modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmDelete}
        title="Delete records?"
        message={`This will permanently delete ${confirmState?.label}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
      />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg"
          style={{ background: toast.ok ? 'var(--color-primary)' : '#ef4444' }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
