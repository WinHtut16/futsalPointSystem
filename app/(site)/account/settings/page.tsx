import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SiteNavbar from '@/components/booking/SiteNavbar'
import AccountSettingsForm from '@/components/customer/account/AccountSettingsForm'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage() {
  const [profile, supabase] = await Promise.all([getCurrentUser(), createClient()])
  if (!profile) redirect('/login?next=/account/settings')

  const { data: { user } } = await supabase.auth.getUser()
  // Only show a real email — derived @akoatp.com emails are not user-visible
  const initialEmail =
    user?.email && !user.email.endsWith('@akoatp.com') ? user.email : ''

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar active="account" />
      <AccountSettingsForm
        initialName={profile.username}
        initialPhone={profile.phone ?? ''}
        initialEmail={initialEmail}
      />
    </div>
  )
}