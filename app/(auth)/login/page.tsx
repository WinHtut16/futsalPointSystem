import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'
import AuthShell from '@/components/auth/AuthShell'
import T from '@/components/ui/T'

export default function LoginPage() {
  return (
    <AuthShell heading="Mya Thida" tagline={<T k="auth.tagline" />}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
