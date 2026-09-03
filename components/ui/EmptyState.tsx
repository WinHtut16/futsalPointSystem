import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  action?: EmptyStateAction
  className?: string
}

/**
 * Shared empty-state recipe — see DESIGN.md. Icon tile → message → optional
 * CTA text link. Every list screen should render one instead of a bare
 * `.map()` over nothing.
 */
export default function EmptyState({ icon: Icon, message, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm', className)}>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
        <Icon className="h-7 w-7 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">{message}</p>
      {action && (
        action.href ? (
          <Link href={action.href} className="mt-2 inline-block text-sm text-brand-600 hover:underline font-medium">
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="mt-2 text-sm text-brand-600 hover:underline font-medium"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
