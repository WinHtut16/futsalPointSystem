'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import LanguageToggle from '@/components/ui/LanguageToggle'

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    // Ensure NEXT_PUBLIC_SITE_URL is set correctly in Vercel environment variables for each deployment
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/admin/reset-password`,
    })
    if (resetError) {
      setError('Unable to send reset email. Please try again.')
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'linear-gradient(160deg, var(--color-primary), var(--color-primary-dark))' }}
    >
      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle variant="light" />
      </div>
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
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center justify-center" style={{ width: 84, height: 84, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 20 }}>
            <Image src="/logo_black.jpg" alt="Mya Thida Futsal" width={928} height={844} className="rounded-xl object-contain" style={{ width: 52, height: 52 }} />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">Reset Password</h1>
          <p className="mt-1 text-sm text-white/75">Owner account only</p>
        </div>
        <div className="bg-white p-6" style={{ borderRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-lg)' }}>
          {sent ? (
            <div className="text-center space-y-3 py-2">
              <p className="text-green-600 font-semibold">Reset link sent!</p>
              <p className="text-sm text-gray-500">
                Check your email and click the link to reset your password.
              </p>
              <Link href="/admin/login" className="block text-sm text-brand-600 hover:underline mt-2">
                ← Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-500">
                Enter your email address and we'll send you a reset link.
              </p>
              <Input
                id="email"
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <Button type="submit" size="lg" loading={loading}>
                Send Reset Link
              </Button>
              <p className="text-center">
                <Link href="/admin/login" className="text-sm text-brand-600 hover:underline">
                  ← Back to login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
