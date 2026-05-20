import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import AdminNav from '@/components/admin/AdminNav'
import LogoutButton from '@/components/admin/LogoutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUser()
  if (!profile || profile.role !== 'admin') redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between shadow">
        <span className="font-bold">⚽ Admin Panel</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{profile.username}</span>
          <LogoutButton />
        </div>
      </header>
      <AdminNav />
      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">{children}</main>
    </div>
  )
}
