import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import CustomerNav from '@/components/customer/CustomerNav'
import LogoutButton from '@/components/customer/LogoutButton'
import LanguageToggle from '@/components/ui/LanguageToggle'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUser()
  if (!profile || profile.role !== 'customer') redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-brand-600 text-white px-4 py-2 flex items-center justify-between shadow">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_white.jpg" alt="Mya Thida" className="h-10 w-10 rounded-lg object-contain bg-white" />
          <span className="font-bold text-base leading-tight">Mya Thida<br /><span className="text-brand-200 text-xs font-normal">Futsal Field</span></span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle variant="light" />
          <span className="text-sm text-brand-200">{profile.username}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 pb-20">{children}</main>
      <CustomerNav />
    </div>
  )
}
