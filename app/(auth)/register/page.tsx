import { Suspense } from 'react'
import Link from 'next/link'
import RegisterForm from '@/components/auth/RegisterForm'
import AuthShell from '@/components/auth/AuthShell'
import T from '@/components/ui/T'

export default function RegisterPage() {
  return (
    <AuthShell heading={<T k="auth.createHeading" />} tagline={<T k="auth.createTagline" />}>
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
