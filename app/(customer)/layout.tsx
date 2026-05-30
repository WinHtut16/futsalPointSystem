import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import CustomerNav from '@/components/customer/CustomerNav'
import LogoutButton from '@/components/customer/LogoutButton'
import LanguageToggle from '@/components/ui/LanguageToggle'

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUser()
  if (!profile || profile.role !== 'customer') redirect('/login')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-background)' }}>
      <header style={{
        background: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        padding: '12px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_white.jpg"
            alt="Mya Thida"
            style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'contain', background: 'rgba(255,255,255,0.15)' }}
          />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Mya Thida
            </div>
            <div style={{ fontSize: 10, opacity: 0.6, fontFamily: 'var(--font-display)' }}>
              Futsal Field
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LanguageToggle variant="light" />
          <span style={{ fontSize: 12, opacity: 0.8, fontFamily: 'var(--font-display)' }}>
            {profile.username}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 pb-20">{children}</main>
      <CustomerNav />
    </div>
  )
}
