'use client'

import { useEffect, useId } from 'react'
import { cn } from '@/lib/utils'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Bottom sheet — the mobile nav's "More" menu, and any other mobile-first
 * drawer. See DESIGN.md. Distinct from Modal/ConfirmModal (centered dialogs
 * that become a bottom sheet only below `sm:`): this one is always
 * anchored to the bottom, full width, with a drag-handle affordance.
 */
export default function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          'relative w-full sm:max-w-md bg-white rounded-t-3xl shadow-xl',
          'pb-[calc(env(safe-area-inset-bottom)+1rem)]',
          className
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>
        {title && (
          <div className="px-5 pb-2">
            <h2 id={titleId} className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
        )}
        <div className="px-5 pt-2">{children}</div>
      </div>
    </div>
  )
}
