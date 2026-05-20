'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { phoneToEmail, normalizePhone } from '@/lib/utils'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function RegisterForm() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const normalized = normalizePhone(phone)
    if (!/^09\d{7,9}$/.test(normalized)) {
      setError('Enter a valid Myanmar phone number (e.g. 09XXXXXXXXX).')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email: phoneToEmail(normalized),
      password,
      options: {
        data: { phone: normalized, username: username.trim() },
      },
    })

    if (authError) {
      const msg = authError.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('email address') ) {
        setError('This phone number is already registered.')
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('Too many attempts. Please wait a few minutes and try again.')
      } else if (msg.includes('password')) {
        setError('Password must be at least 6 characters.')
      } else {
        setError('Registration failed. Please check your details and try again.')
      }
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="phone"
        label="Phone Number"
        type="tel"
        placeholder="09XXXXXXXXX"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        autoComplete="tel"
      />
      <Input
        id="username"
        label="Username"
        type="text"
        placeholder="Your name or nickname"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="username"
        minLength={2}
        maxLength={50}
      />
      <Input
        id="password"
        label="Password"
        type="password"
        placeholder="Min. 6 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={6}
      />
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      <Button type="submit" size="lg" loading={loading}>
        Create Account
      </Button>
    </form>
  )
}
