import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import CustomerNav from '@/components/customer/CustomerNav'
import LogoutButton from '@/components/customer/LogoutButton'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUser()
  if (!profile || profile.role !== 'customer') redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between shadow">
        <span className="font-bold text-lg">⚽ AkoATP Points</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-brand-200">{profile.username}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 pb-20">{children}</main>
      <CustomerNav />
    </div>
  )
}
