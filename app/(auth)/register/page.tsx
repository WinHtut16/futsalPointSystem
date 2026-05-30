import RegisterForm from '@/components/auth/RegisterForm'
import T from '@/components/ui/T'
import LanguageToggle from '@/components/ui/LanguageToggle'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(160deg, var(--color-primary), var(--color-primary-dark))' }}
    >
      {/* Football pitch watermark */}
      <svg
        viewBox="0 0 390 400"
        className="pointer-events-none absolute inset-0 w-full h-full"
        style={{ opacity: 0.07 }}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <rect x="20" y="20" width="350" height="360" stroke="white" strokeWidth="2" fill="none" />
        <line x1="20" y1="200" x2="370" y2="200" stroke="white" strokeWidth="1.5" />
        <circle cx="195" cy="200" r="55" stroke="white" strokeWidth="1.5" fill="none" />
      </svg>

      {/* Language toggle */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle variant="light" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-[18px] py-8">
        {/* Brand */}
        <div className="text-center pt-6 pb-6">
          <div
            className="inline-flex items-center justify-center mb-4"
            style={{
              width: 84,
              height: 84,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_black.jpg"
              alt="Mya Thida"
              className="rounded-xl object-contain"
              style={{ width: 52, height: 52 }}
            />
          </div>
          <h1
            className="text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            Myathida Futsal
          </h1>
          <p
            className="mt-1"
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', fontFamily: 'var(--font-display)' }}
          >
            <T k="auth.createTagline" />
          </p>
        </div>

        {/* Form card */}
        <div className="w-full max-w-sm">
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--r-2xl)',
              padding: 24,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 19,
                fontWeight: 800,
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.01em',
                margin: '0 0 18px',
              }}
            >
              <T k="auth.createHeading" />
            </h2>
            <RegisterForm />
            <p className="text-center text-sm mt-4" style={{ color: 'var(--color-text-muted)' }}>
              <T k="auth.haveAccount" />{' '}
              <Link
                href="/login"
                className="font-semibold hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                <T k="auth.signInLink" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
