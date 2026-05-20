import Link from 'next/link'
import type { Profile } from '@/types'

interface CustomerRowProps {
  customer: Profile
}

export default function CustomerRow({ customer }: CustomerRowProps) {
  return (
    <Link
      href={`/admin/customers/${customer.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <div>
        <p className="text-sm font-medium text-gray-900">{customer.username}</p>
        <p className="text-xs text-gray-500">{customer.phone}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-brand-600">{customer.total_points} pts</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
