import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import T from '@/components/ui/T'
import { formatDate } from '@/lib/utils'
import { UserCog, Plus } from 'lucide-react'
import { getAvatarColor, getInitials } from '@/lib/avatar'

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
        <h1 className="text-xl font-bold text-gray-900">
          <T k="admin.pageHeadingStaff" />
        </h1>
        <Link href="/admin/staff/new">
          <Button size="sm">
            <Plus className="w-4 h-4 -ml-0.5 mr-1" />
            <T k="admin.newAdmin" />
          </Button>
        </Link>
      </div>

      {staff && staff.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Staff
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Role
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Joined
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map((s) => {
                  const color = getAvatarColor(s.username)
                  const initials = getInitials(s.username)
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color.bg} ${color.text}`}
                          >
                            {initials}
                          </div>
                          <span className="text-sm font-medium text-gray-900 group-hover:text-primary transition-colors">
                            {s.username}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          <T k="admin.staffRoleLabel" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/staff/${s.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-300"
                        >
                          <T k="admin.manageButton" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden divide-y divide-gray-100">
            {staff.map((s) => {
              const color = getAvatarColor(s.username)
              const initials = getInitials(s.username)
              return (
                <Link
                  key={s.id}
                  href={`/admin/staff/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${color.bg} ${color.text}`}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{s.username}</p>
                    <p className="text-xs text-gray-400">
                      <T k="admin.staffAdded" vars={{ date: formatDate(s.created_at) }} />
                    </p>
                  </div>
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                    <T k="admin.staffRoleLabel" />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-14 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <UserCog className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            <T k="admin.noStaff" />
          </p>
          <Link href="/admin/staff/new" className="inline-block mt-3 text-sm text-brand-600 hover:underline font-medium">
            <T k="admin.createOne" />
          </Link>
        </div>
      )}
    </div>
  )
}
