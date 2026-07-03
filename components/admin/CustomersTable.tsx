'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CustomerRow from '@/components/admin/CustomerRow'
import type { Profile } from '@/types'

const PAGE_SIZE = 20

interface CustomersTableProps {
  customers: Profile[]
  hoursMap?: Map<string, number>
}

export default function CustomersTable({ customers, hoursMap }: CustomersTableProps) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const slice = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return customers.slice(start, start + PAGE_SIZE)
  }, [customers, safePage])

  const start = customers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const end = Math.min(safePage * PAGE_SIZE, customers.length)

  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '…')[] = [1]
    if (safePage > 3) pages.push('…')
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++)
      pages.push(i)
    if (safePage < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  if (customers.length === 0) return null

  const pagination =
    totalPages > 1 ? (
      <div className="flex flex-col items-center gap-3 px-4 pb-3 pt-2 sm:flex-row sm:justify-between border-t border-gray-100">
        <p className="text-xs text-ink-muted">
          {`Showing ${start}–${end} of ${customers.length}`}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          {pageNumbers().map((p, i) =>
            p === '…' ? (
              <span
                key={`ellipsis-${i}`}
                className="flex h-8 w-8 items-center justify-center text-xs text-ink-muted"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p as number)}
                className={
                  p === safePage
                    ? 'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors text-white'
                    : 'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-ink-muted transition-colors hover:bg-black/5'
                }
                style={p === safePage ? { background: 'var(--color-primary)' } : undefined}
                aria-current={p === safePage ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    ) : null

  return (
    <div>
      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Points</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Hours</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Joined</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {slice.map((c) => (
              <CustomerRow
                key={c.id}
                customer={c}
                hoursPlayed={hoursMap?.get(c.id)}
                variant="table"
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {slice.map((c) => (
          <CustomerRow key={c.id} customer={c} hoursPlayed={hoursMap?.get(c.id)} variant="card" />
        ))}
      </div>

      {pagination}
    </div>
  )
}
