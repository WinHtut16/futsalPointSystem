import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Lock } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getMyApps } from '@/lib/apps.server'
import { APPS, type AppGrant } from '@/lib/apps'
import LanguageToggle from '@/components/ui/LanguageToggle'
import LogoutButton from '@/components/admin/LogoutButton'
import T from '@/components/ui/T'

export const dynamic = 'force-dynamic'

/**
 * The chooser. Renders only the businesses this account has been granted, which
 * is a security property rather than a cosmetic one — a futsal-only staffer is
 * never shown that a billiards panel exists.
 *
 * Reached only when the account has zero or several grants; a single-business
 * admin is sent straight into their panel by /admin and never sees this page.
 */
export default async function AppsPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/admin/login?next=/admin/apps')
  if (profile.role !== 'admin' && profile.role !== 'superadmin') redirect('/account')

  const apps = await getMyApps()
  const failed = apps === null
  const granted = apps ?? []

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'linear-gradient(160deg, var(--color-primary), var(--color-primary-dark))' }}
    >
      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle variant="light" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-3 flex items-center justify-center"
            style={{
              width: 72,
              height: 72,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 18,
            }}
          >
            <Image
              src="/logo_black.jpg"
              alt="MyaThida"
              width={928}
              height={844}
              className="rounded-xl object-contain"
              style={{ width: 46, height: 46 }}
            />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">
            <T k="portal.greeting" vars={{ name: profile.username }} />
          </h1>
          <p className="mt-1 text-sm text-white/75">
            <T
              k={
                failed
                  ? 'portal.loadFailedTagline'
                  : granted.length === 0
                    ? 'portal.noAccessTagline'
                    : 'portal.tagline'
              }
            />
          </p>
        </div>

        {granted.length === 0 ? <NoAccess failed={failed} /> : <AppGrid apps={granted} />}

        <div className="mt-7 flex justify-center">
          <div className="rounded-lg bg-white/95 p-1">
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  )
}

function AppGrid({ apps }: { apps: AppGrant[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {apps.map(({ app, role }) => {
        const meta = APPS[app]

        const inner = (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1"
              style={{ background: meta.accent }}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-ink-primary">
                  <T k={meta.titleKey} />
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  <T k={meta.descKey} />
                </p>
              </div>
              {meta.live ? (
                <ArrowRight size={18} className="mt-0.5 shrink-0 text-gray-400" strokeWidth={2} />
              ) : (
                <Lock size={16} className="mt-1 shrink-0 text-gray-400" strokeWidth={2} />
              )}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ background: `${meta.accent}14`, color: meta.accent }}
              >
                <T k={role === 'superadmin' ? 'portal.roleSuperadmin' : 'portal.roleAdmin'} />
              </span>
              {!meta.live && (
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  <T k="portal.comingSoon" />
                </span>
              )}
            </div>
          </>
        )

        const shell =
          'relative block overflow-hidden bg-white p-5 text-left transition-shadow'

        // A tile for a zone that is not deployed yet is deliberately not a link.
        // Showing it greyed out tells the owner the plan is on track; making it
        // clickable would just produce a 404.
        return meta.live ? (
          <Link
            key={app}
            href={meta.href}
            className={`${shell} hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
            style={{ borderRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-lg)' }}
          >
            {inner}
          </Link>
        ) : (
          <div
            key={app}
            aria-disabled="true"
            className={`${shell} opacity-60`}
            style={{ borderRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-lg)' }}
          >
            {inner}
          </div>
        )
      })}
    </div>
  )
}

function NoAccess({ failed }: { failed: boolean }) {
  return (
    <div
      className="bg-white p-6 text-center"
      style={{ borderRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-lg)' }}
    >
      <Lock size={22} className="mx-auto mb-3 text-gray-400" strokeWidth={2} />
      <p className="text-sm text-gray-600">
        <T k={failed ? 'portal.loadFailedBody' : 'portal.noAccessBody'} />
      </p>
    </div>
  )
}
