import { Suspense } from 'react'
import Image from 'next/image'
import AdminLoginForm from '@/components/auth/AdminLoginForm'
import LanguageToggle from '@/components/ui/LanguageToggle'
import T from '@/components/ui/T'

export default function AdminLoginPage() {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'linear-gradient(160deg, var(--color-primary), var(--color-primary-dark))' }}
    >
      {/* football pitch watermark */}
      <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: 0.07 }} aria-hidden="true">
        <g stroke="#fff" strokeWidth="2" fill="none">
          <rect x="20" y="20" width="360" height="560" />
          <line x1="20" y1="300" x2="380" y2="300" />
          <circle cx="200" cy="300" r="60" />
          <circle cx="200" cy="300" r="3" fill="#fff" />
          <rect x="120" y="20" width="160" height="80" />
          <rect x="120" y="500" width="160" height="80" />
          <rect x="165" y="20" width="70" height="30" />
          <rect x="165" y="550" width="70" height="30" />
        </g>
      </svg>
      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle variant="light" />
      </div>
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center justify-center" style={{ width: 84, height: 84, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 20 }}>
            <Image src="/logo_black.jpg" alt="Mya Thida Futsal" width={928} height={844} className="rounded-xl object-contain" style={{ width: 52, height: 52 }} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">Mya Thida</h1>
          <p className="mt-1 text-sm text-white/75"><T k="auth.adminPortalTagline" /></p>
        </div>
        <div className="bg-white p-6" style={{ borderRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-lg)' }}>
          <Suspense>
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
