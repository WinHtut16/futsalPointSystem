'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { usernameToAdminEmail } from '@/lib/utils'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(
    searchParams.get('error') === 'invalid_link' ? 'Invalid or expired reset link.' : ''
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const email = identifier.includes('@') ? identifier.trim() : usernameToAdminEmail(identifier)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid credentials.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Authentication failed.'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
      await supabase.auth.signOut()
      setError('Access denied. This login is for staff only.')
      setLoading(false)
      return
    }

    router.push('/admin/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="identifier"
        label="Username or Email"
        type="text"
        placeholder="Enter username or email"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        required
        autoComplete="username"
      />
      <Input
        id="password"
        label="Password"
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <Button type="submit" size="lg" loading={loading}>
        Sign In
      </Button>
      <p className="text-center text-sm text-gray-500">
        <Link href="/admin/forgot-password" className="text-brand-600 font-medium hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  )
}
