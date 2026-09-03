/**
 * Loading-skeleton primitives — see DESIGN.md and the "Loading Skeletons"
 * section of CLAUDE.md for the conventions these encode: no spinner, every
 * shape mirrors the real content, admin skeletons render inside
 * `space-y-5` (AdminShell's `<main>` already supplies padding/max-width).
 *
 * Existing `loading.tsx` files predate this — they inline the same
 * `animate-pulse` recipe by hand. This is the reusable version for new
 * loading states; migrating the existing ones is optional cleanup, not a
 * required rewrite.
 */
import { cn } from '@/lib/utils'

export function Bar({ w = '100%', h = 12, className }: { w?: string; h?: number; className?: string }) {
  return <div className={cn('rounded bg-gray-200 animate-pulse', className)} style={{ width: w, height: h }} />
}

export function Card({ children }: { children?: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">{children}</div>
}

export function ListCard({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Bar w="40px" h={40} className="rounded-full shrink-0 bg-gray-100" />
          <div className="flex-1 space-y-1.5">
            <Bar w={`${72 - i * 6}%`} h={13} />
            <Bar w="40%" h={11} className="bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableCard({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-50">
        <Bar w="140px" h={11} className="bg-gray-100" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid gap-3 px-4 py-3 items-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: cols }).map((_, j) => (
              <Bar key={j} w={j === 0 ? '80%' : '50%'} h={12} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
