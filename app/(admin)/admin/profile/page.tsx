import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import AdminProfileForm from '@/components/admin/AdminProfileForm'

export const dynamic = 'force-dynamic'

export default async function AdminProfilePage() {
  const profile = await getCurrentUser()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    redirect('/admin/login')
  }
  return <AdminProfileForm initialName={profile.username} />
}