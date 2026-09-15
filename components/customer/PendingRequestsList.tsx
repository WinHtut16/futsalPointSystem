'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { RedemptionRequest } from '@/types'
import PendingRequestItem from './PendingRequestItem'
import Card from '@/components/ui/Card'

interface StatusNotification {
  id: string
  type: 'approved' | 'rejected'
}

const POLL_MS = 20_000

export default function PendingRequestsList({
  initialRequests,
  userId,
}: {
  initialRequests: RedemptionRequest[]
  userId: string
}) {
  const { t } = useLanguage()
  const [requests, setRequests] = useState<RedemptionRequest[]>(initialRequests)
  const [notifications, setNotifications] = useState<StatusNotification[]>([])
  const requestsRef = useRef(requests)

  useEffect(() => { requestsRef.current = requests }, [requests])

  const handleResolved = useCallback((id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const fetchPending = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('redemption_requests')
      .select('*, reward:rewards(name, points_cost)')
      .eq('customer_id', userId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
    if (!data) return

    const next = data as RedemptionRequest[]
    const before = requestsRef.current
    setRequests(next)

    /**
     * Anything that was pending on the last pass and is not pending now was
     * resolved while the customer had this screen open. Announcing that used to
     * be the Realtime channel's job; the channel could never connect (see the
     * effect below), so the banner has been silently dead. This brings it back
     * without it: one extra query, and only when something actually moved.
     *
     * A request the customer cancelled themselves also disappears from the
     * list, which is why this re-reads the status rather than assuming - a
     * cancellation comes back 'cancelled' and is filtered out, so nobody is
     * told their own cancellation was "approved".
     */
    const stillPending = new Set(next.map((r) => r.id))
    const goneIds = before.filter((r) => !stillPending.has(r.id)).map((r) => r.id)
    if (goneIds.length === 0) return

    const { data: settled } = await supabase
      .from('redemption_requests')
      .select('id, status')
      .in('id', goneIds)
    if (!settled) return

    const announce = (settled as { id: string; status: string }[]).filter(
      (r) => r.status === 'approved' || r.status === 'rejected'
    )
    if (announce.length === 0) return

    setNotifications((curr) => [
      ...curr,
      ...announce
        .filter((r) => !curr.some((n) => n.id === r.id))
        .map((r) => ({ id: r.id, type: r.status as 'approved' | 'rejected' })),
    ])
  }, [userId])

  /**
   * Polled, never Realtime.
   *
   * A postgres_changes channel used to live here and drive the banner above. It
   * never connected once: the browser Supabase client talks through the
   * same-origin /sb rewrite so Myanmar operators filtering *.supabase.co have no
   * hostname to match, and Vercel does not upgrade WebSocket connections across
   * a rewrite - next.config.js says so in full where that rule is defined. It
   * only ever failed and retried, on a loop, for as long as this screen was
   * open. fetchPending now does both jobs.
   */
  useEffect(() => {
    const timer = setInterval(fetchPending, POLL_MS)
    return () => clearInterval(timer)
  }, [fetchPending])

  // Expire the banners. Its own effect on purpose: the timer belongs to this
  // component's lifetime, not to whichever poll happened to spot the change,
  // so unmounting mid-countdown cannot leave a setState behind.
  useEffect(() => {
    if (notifications.length === 0) return
    const timer = setTimeout(() => setNotifications((curr) => curr.slice(1)), 5000)
    return () => clearTimeout(timer)
  }, [notifications])

  if (requests.length === 0 && notifications.length === 0) return null

  return (
    <Card className="p-0 overflow-hidden">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${
            n.type === 'approved'
              ? 'bg-green-50 text-green-700 border-b border-green-100'
              : 'bg-red-50 text-red-600 border-b border-red-100'
          }`}
        >
          {n.type === 'approved'
            ? <CheckCircle className="w-4 h-4 shrink-0 text-green-600" />
            : <XCircle className="w-4 h-4 shrink-0 text-red-500" />
          }
          <span>{n.type === 'approved' ? t('history.approved') : t('history.rejected')}</span>
        </div>
      ))}

      {requests.length > 0 && (
        <>
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-700">{t('history.pendingRequests')}</h2>
            <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {requests.length}
            </span>
          </div>
          <div className="px-4">
            {requests.map((req) => (
              <PendingRequestItem key={req.id} request={req} onResolved={handleResolved} />
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
