'use client'

import { useState, useEffect, useCallback } from 'react'
import type { RedemptionRequest } from '@/types'
import RedemptionRequestCard from './RedemptionRequestCard'
import { createClient } from '@/lib/supabase/client'

const POLL_MS = 20_000
const SELECT_QUERY =
  '*, reward:rewards(name, points_cost), customer:profiles!customer_id(username, phone, total_points)'

export default function RedemptionsList({ initialRequests }: { initialRequests: RedemptionRequest[] }) {
  const [requests, setRequests] = useState<RedemptionRequest[]>(initialRequests)
  const [query, setQuery] = useState('')

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
          if ((payload.new as { status: string }).status !== 'pending') return
          const { data } = await supabase
            .from('redemption_requests')
            .select(SELECT_QUERY)
            .eq('id', (payload.new as { id: string }).id)
            .single()
          if (data) setRequests((prev) => [...prev, data as RedemptionRequest])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'redemption_requests' },
        (payload) => {
          const updated = payload.new as { id: string; status: string }
          if (updated.status !== 'pending') {
            setRequests((prev) => prev.filter((r) => r.id !== updated.id))
          }
        }
      )
      .subscribe()

    const timer = setInterval(fetchAll, POLL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchAll])

  const filtered = query.trim()
    ? requests.filter((r) => {
        const q = query.toLowerCase()
        return (
          r.customer?.username.toLowerCase().includes(q) ||
          r.customer?.phone.includes(q) ||
          r.reward?.name.toLowerCase().includes(q)
        )
      })
    : requests

  return (
    <div className="space-y-4">
      {requests.length > 0 && (
        <span className="inline-block bg-yellow-100 text-yellow-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
          {requests.length} pending
        </span>
      )}

      <input
        type="search"
        placeholder="Search by name, phone, or reward..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
      />

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((req) => (
            <RedemptionRequestCard key={req.id} request={req} onResolved={handleResolved} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-sm">
            {query ? 'No requests match your search.' : 'No pending redemption requests.'}
          </p>
        </div>
      )}
    </div>
  )
}
