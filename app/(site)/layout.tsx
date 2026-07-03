import { getCurrentUser } from '@/lib/auth'
import SiteNavbar from '@/components/booking/SiteNavbar'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const firstName = user?.username?.split(' ')[0] ?? null
  return (
    <div className="min-h-screen bg-[var(--color-background)] font-body text-ink">
      <SiteNavbar initialFirstName={firstName} />
      {children}
    </div>
  )
}
