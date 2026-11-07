import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LayoutGrid } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getAppRole } from '@/lib/apps.server'
import { APPS } from '@/lib/apps'
import { isLoyaltyApp } from '@/lib/loyalty'
import LoyaltyTabs from '@/components/loyalty/LoyaltyTabs'
import LanguageToggle from '@/components/ui/LanguageToggle'
import LogoutButton from '@/components/admin/LogoutButton'
import T from '@/components/ui/T'

/**
 * Points & rewards for the game shop or billiards.
 *
 * Lives in the (portal) group, not (admin): (admin) IS the futsal business
 * and requires a futsal grant, which a billiards-only manager does not hold.
 * Entry here needs a grant for THIS business. Every API this section calls
 * (/api/loyalty/<app>/...) checks the same grant again and pins every query
 * to the business, so the page guard is a courtesy, not the boundary.
 */
export default async function LoyaltyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ app: string }>
}) {
  const { app } = await params
  if (!isLoyaltyApp(app)) notFound()

  const profile = await getCurrentUser()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) redirect('/admin/login')

  // null = no grant (or the lookup failed): deny either way, never allow on error.
  if ((await getAppRole(app)) === null) redirect('/admin/apps')

  const meta = APPS[app]

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <span aria-hidden="true" className="block h-1" style={{ background: meta.accent }} />
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          {/* Plain <a>: the business's own panel is another Next.js zone. */}
          <a
            href={meta.href}
            className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink-primary"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="truncate">
              <T k={meta.titleKey} />
            </span>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/apps"
              prefetch={false}
              className="hidden sm:flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink-primary"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <T k="loyalty.allBusinesses" />
            </Link>
            <LanguageToggle variant="admin" />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900">
            <T k={meta.titleKey} /> · <T k="loyalty.title" />
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            <T k="loyalty.subtitle" />
          </p>
        </div>
        <LoyaltyTabs app={app} accent={meta.accent} />
        {children}
      </div>
    </main>
  )
}
