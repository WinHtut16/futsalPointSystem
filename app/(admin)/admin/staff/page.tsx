import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import T from '@/components/ui/T'
import { formatDate } from '@/lib/utils'

export default async function StaffPage() {
  const supabase = await createClient()
  const { data: staff } = await supabase
    .from('profiles')
    .select('id, username, role, created_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900"><T k="admin.pageHeadingStaff" /></h1>
        <Link href="/admin/staff/new">
          <Button size="sm"><T k="admin.newAdmin" /></Button>
        </Link>
      </div>

      <Card className="p-0">
        {staff && staff.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {staff.map((s) => (
              <Link
                key={s.id}
                href={`/admin/staff/${s.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.username}</p>
                  <p className="text-xs text-gray-400"><T k="admin.staffAdded" vars={{ date: formatDate(s.created_at) }} /></p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  <T k="admin.staffRoleLabel" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">
            <T k="admin.noStaff" />{' '}
            <Link href="/admin/staff/new" className="text-brand-600 hover:underline">
              <T k="admin.createOne" />
            </Link>
          </p>
        )}
      </Card>
    </div>
  )
}
