import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import AccountSettingsForm from '@/components/customer/account/AccountSettingsForm'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login?next=/account/settings')

  return (
    <AccountSettingsForm
      initialName={profile.username}
      initialPhone={profile.phone ?? ''}
    />
  )
}