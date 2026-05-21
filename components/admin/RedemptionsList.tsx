'use client'

import { useState } from 'react'
import type { RedemptionRequest } from '@/types'
import RedemptionRequestCard from './RedemptionRequestCard'

export default function RedemptionsList({ requests }: { requests: RedemptionRequest[] }) {
  const [query, setQuery] = useState('')

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
            <RedemptionRequestCard key={req.id} request={req} />
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
