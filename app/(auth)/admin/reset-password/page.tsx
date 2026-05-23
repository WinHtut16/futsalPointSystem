'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function AdminResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setError('Invalid or expired reset link. Please request a new one.')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setError(updateError.message); setLoading(false); return }
    // Revoke all sessions globally so the old session can't be reused
    await supabase.auth.signOut({ scope: 'global' })
    setSuccess(true)
    setTimeout(() => router.push('/admin/login'), 2000)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_black.jpg" alt="Mya Thida" className="w-28 h-28 rounded-2xl object-contain shadow-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">New Password</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {success ? (
            <div className="text-center py-2 space-y-2">
              <p className="text-green-600 font-semibold">Password updated!</p>
              <p className="text-sm text-gray-500">Redirecting to login...</p>
            </div>
          ) : !ready && !error ? (
            <p className="text-center text-sm text-gray-400 py-4">Verifying link...</p>
          ) : !ready && error ? (
            <div className="text-center space-y-3 py-2">
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              <Link href="/admin/forgot-password" className="text-sm text-brand-600 hover:underline">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="password"
                label="New Password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Input
                id="confirm"
                label="Confirm Password"
                type="password"
                placeholder="Repeat new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <Button type="submit" size="lg" loading={loading}>
                Set New Password
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
