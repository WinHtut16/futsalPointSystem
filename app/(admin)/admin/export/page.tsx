import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import ExportPanel from '@/components/admin/ExportPanel'

export const dynamic = 'force-dynamic'

export default async function ExportPage() {
  // Middleware already gates this route to superadmin; this is defense-in-depth.
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (user.role !== 'superadmin') redirect('/admin/dashboard')

  return <ExportPanel />
}
