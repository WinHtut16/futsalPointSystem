import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getMyApps, landingFor } from '@/lib/apps'

export const dynamic = 'force-dynamic'

/**
 * /admin is a router, not a page.
 *
 * It is the installed PWA's start_url, where the login form sends people, and
 * what anyone who bookmarks "the admin site" will land on. Putting the decision
 * here rather than in the login form means all three routes behave identically:
 * one business goes straight in, several show the chooser.
 */
export default async function AdminEntryPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/admin/login?next=/admin')
  if (profile.role !== 'admin' && profile.role !== 'superadmin') redirect('/account')

  redirect(landingFor(await getMyApps()))
}
