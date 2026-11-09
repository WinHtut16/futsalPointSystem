import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import AccountSettingsForm from '@/components/customer/account/AccountSettingsForm'
import { settingsBackHref } from '@/lib/venue-account'

export const dynamic = 'force-dynamic'

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ back?: string }>
}) {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login?next=/account/settings')
  // Opened from a venue's points portal: the back arrow returns there.
  const backHref = settingsBackHref((await searchParams).back)

  return (
    <AccountSettingsForm
      initialName={profile.username}
      initialPhone={profile.phone ?? ''}
      backHref={backHref}
    />
  )
}