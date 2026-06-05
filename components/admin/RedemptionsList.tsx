'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Clock, XCircle, Ban, ShoppingBag } from 'lucide-react'
import type { RedemptionRequest, RedemptionStatus } from '@/types'
import RedemptionRequestCard from './RedemptionRequestCard'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatDateTime } from '@/lib/utils'

const POLL_MS = 20_000
const SELECT_QUERY =
  '*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone, total_points)'

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
}: {
  initialRequests: RedemptionRequest[]
  initialHistory: RedemptionRequest[]
}) {
  const [requests, setRequests] = useState<RedemptionRequest[]>(initialRequests)
  const { t } = useLanguage()

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
        (payload) => {
          try {
            const updated = payload.new as { id: string; status: string }
            if (updated.status !== 'pending') {
              setRequests((prev) => prev.filter((r) => r.id !== updated.id))
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
      {initialHistory.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {t('admin.historySection')}
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {initialHistory.map((req) => (
              <div key={req.id} className="flex items-center gap-3 px-4 py-3">
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
                    {req.resolved_at ? formatDateTime(req.resolved_at) : formatDateTime(req.requested_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {initialHistory.length === 0 && requests.length === 0 && (
        <p className="text-center text-xs text-gray-400 pb-4">{t('admin.noHistory')}</p>
      )}
    </div>
  )
}
