import Link from 'next/link'
import CreateAdminForm from '@/components/admin/CreateAdminForm'
import T from '@/components/ui/T'
import { ChevronLeft, Shield } from 'lucide-react'

export default function NewStaffPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/staff"
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
        >
          <ChevronLeft className="w-4 h-4" />
          <T k="admin.backToStaff" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">
          <T k="admin.newAdminTitle" />
        </h1>
      </div>

      <div className="max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          {/* Role indicator — no selector, always Admin */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                <T k="admin.staffRoleLabel" />
              </p>
              <p className="text-xs text-blue-600">Can manage customers, points, and bookings</p>
            </div>
          </div>

          <CreateAdminForm />
        </div>
      </div>
    </div>
  )
}
