import { Suspense } from 'react'
import Link from 'next/link'
import RegisterForm from '@/components/auth/RegisterForm'
import AuthShell from '@/components/auth/AuthShell'
import T from '@/components/ui/T'
import { parseBusiness } from '@/lib/points'

/**
 * One sign-up for all three businesses. /register?from=game or
 * ?from=billiards (the QR code at that counter) gets a heading for that
 * business and lands on its points afterwards; the account itself is the
 * same either way.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const from = parseBusiness((await searchParams).from)
  const tagline =
    from === 'game' ? 'auth.fromGame' : from === 'billiards' ? 'auth.fromBilliards' : 'auth.createTagline'

  return (
    <AuthShell heading={<T k="auth.createHeading" />} tagline={<T k={tagline} />}>
      <p className="mb-4 rounded-[var(--r-md)] bg-primary-soft px-3 py-2.5 text-center text-[13px] text-primary">
        <T k="auth.oneAccountNote" />
      </p>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
      <p className="mt-4 text-center text-sm text-ink-muted">
        <T k="auth.haveAccount" />{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          <T k="auth.signInLink" />
        </Link>
      </p>
    </AuthShell>
  )
}
