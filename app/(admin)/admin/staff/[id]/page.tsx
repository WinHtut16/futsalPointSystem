import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import StaffResetPasswordForm from '@/components/admin/StaffResetPasswordForm'
import AppAccessPanel from '@/components/admin/AppAccessPanel'
import DeleteStaffButton from '@/components/admin/DeleteStaffButton'
import T from '@/components/ui/T'
import { formatDate } from '@/lib/utils'
import { getAvatarColor, getInitials } from '@/lib/avatar'
import { ChevronLeft, Shield, CalendarDays, KeyRound } from 'lucide-react'
import { APP_NAMES, type AppName, type AppRole } from '@/lib/apps'

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

  /**
   * This person's grants, and which businesses the SIGNED-IN admin may change.
   *
   * Both are read here rather than in the panel so the server decides them.
   * can_manage_app() is the same function grant_app_access() enforces with, so
   * a control this admin cannot use is never rendered as usable - and, more to
   * the point, the panel being wrong could only ever mislead, never permit:
   * the database re-checks on every write.
   */
  const { data: accessRows } = await supabase
    .from('app_access')
    .select('app, role')
    .eq('user_id', id)

  const grants: Partial<Record<AppName, AppRole>> = {}
  for (const row of accessRows ?? []) {
    grants[row.app as AppName] = row.role as AppRole
  }

  const manageChecks = await Promise.all(
    APP_NAMES.map(async (app) => {
      const { data } = await supabase.rpc('can_manage_app', { p_app: app })
      return { app, allowed: data === true }
    })
  )
  const manageable = manageChecks.filter((c) => c.allowed).map((c) => c.app)

  const color = getAvatarColor(staff.username)
  const initials = getInitials(staff.username)

  return (
    <div className="space-y-5">
      <Link
        href="/admin/staff"
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
      >
        <ChevronLeft className="w-4 h-4" />
        <T k="admin.backToStaff" />
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-5 items-start">
        {/* LEFT: Profile card */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col items-center text-center gap-3">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${color.bg} ${color.text}`}
              >
                {initials}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{staff.username}</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full mt-1.5">
                  <Shield className="w-3 h-3" />
                  <T k="admin.staffRoleLabel" />
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                <CalendarDays className="w-3.5 h-3.5" />
                <T k="admin.staffAdded" vars={{ date: formatDate(staff.created_at) }} />
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <T k="admin.dangerZone" />
            </p>
            <DeleteStaffButton staffId={id} staffUsername={staff.username} />
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div className="space-y-4">
          {/* Reset password */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-gray-500" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">
                <T k="admin.resetPasswordSection" />
              </h2>
            </div>
            <StaffResetPasswordForm staffId={id} staffUsername={staff.username} />
          </div>

          <AppAccessPanel
            userId={id}
            username={staff.username}
            grants={grants}
            manageable={manageable}
          />
        </div>
      </div>
    </div>
  )
}
