'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import CustomerRow from '@/components/admin/CustomerRow'
import type { Profile } from '@/types'

const PAGE_SIZE = 20

export default function CustomersTable({ customers }: { customers: Profile[] }) {
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
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i)
    if (safePage < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  if (customers.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="divide-y divide-gray-100">
        {slice.map((c) => (
          <CustomerRow key={c.id} customer={c} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-3 px-4 pb-3 pt-2 sm:flex-row sm:justify-between">
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
                <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-ink-muted">…</span>
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
              )
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
      )}
    </div>
  )
}
