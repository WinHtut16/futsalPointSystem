'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
    if (data) setRequests(data as RedemptionRequest[])
  }, [userId])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`customer-requests-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'redemption_requests',
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string }
          const prev = (payload.old as { status?: string }).status

          if (prev === 'pending' && (updated.status === 'approved' || updated.status === 'rejected')) {
            setRequests((curr) => curr.filter((r) => r.id !== updated.id))
            const notif: StatusNotification = { id: updated.id, type: updated.status as 'approved' | 'rejected' }
            setNotifications((curr) => [...curr, notif])
            setTimeout(() => {
              setNotifications((curr) => curr.filter((n) => n.id !== updated.id))
            }, 5000)
          }
        }
      )
      .subscribe()

    const timer = setInterval(fetchPending, POLL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [userId, fetchPending])

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
          <span>{n.type === 'approved' ? '✅' : '❌'}</span>
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
