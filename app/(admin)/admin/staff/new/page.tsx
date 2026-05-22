import Link from 'next/link'
import Card from '@/components/ui/Card'
import CreateAdminForm from '@/components/admin/CreateAdminForm'
import T from '@/components/ui/T'

export default function NewStaffPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/staff" className="text-sm text-brand-600 hover:underline">
          <T k="admin.backToStaff" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1"><T k="admin.newAdminTitle" /></h1>
      </div>
      <Card>
        <CreateAdminForm />
      </Card>
    </div>
  )
}
