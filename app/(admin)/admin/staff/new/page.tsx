import Link from 'next/link'
import Card from '@/components/ui/Card'
import CreateAdminForm from '@/components/admin/CreateAdminForm'

export default function NewStaffPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/staff" className="text-sm text-brand-600 hover:underline">
          ← Staff
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">New Admin Account</h1>
      </div>
      <Card>
        <CreateAdminForm />
      </Card>
    </div>
  )
}
