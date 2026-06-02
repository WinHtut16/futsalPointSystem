import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import SiteNavbar from '@/components/booking/SiteNavbar'
import AccountSettingsForm from '@/components/customer/account/AccountSettingsForm'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login?next=/account/settings')

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar active="account" />
      <AccountSettingsForm
        initialName={profile.username}
        initialPhone={profile.phone ?? ''}
      />
    </div>
  )
}