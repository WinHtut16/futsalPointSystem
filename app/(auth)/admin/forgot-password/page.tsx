'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

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
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/admin/reset-password`,
    })
    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_black.jpg" alt="Mya Thida" className="w-28 h-28 rounded-2xl object-contain shadow-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-gray-400 text-sm mt-1">Owner account only</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
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
