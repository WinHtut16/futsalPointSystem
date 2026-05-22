import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import StaffResetPasswordForm from '@/components/admin/StaffResetPasswordForm'
import DeleteStaffButton from '@/components/admin/DeleteStaffButton'
import T from '@/components/ui/T'
import { formatDate } from '@/lib/utils'

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, username, role, created_at')
    .eq('id', id)
    .eq('role', 'admin')
    .single()

  if (!staff) notFound()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/admin/staff" className="text-sm text-brand-600 hover:underline">
          <T k="admin.backToStaff" />
        </Link>
      </div>

      <Card>
        <p className="text-xl font-bold text-gray-900">{staff.username}</p>
        <p className="text-sm text-gray-400 mt-1"><T k="admin.staffRoleAdded" vars={{ date: formatDate(staff.created_at) }} /></p>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-4"><T k="admin.resetPasswordSection" /></h2>
        <StaffResetPasswordForm staffId={id} staffUsername={staff.username} />
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 mb-3"><T k="admin.dangerZone" /></h2>
        <DeleteStaffButton staffId={id} staffUsername={staff.username} />
      </Card>
    </div>
  )
}
