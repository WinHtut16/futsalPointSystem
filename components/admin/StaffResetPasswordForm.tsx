'use client'

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

interface Props {
  staffId: string
  staffUsername: string
}

export default function StaffResetPasswordForm({ staffId, staffUsername }: Props) {
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    const res = await fetch(`/api/admin/staff/${staffId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to reset password.')
    } else {
      setSuccess(true)
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-gray-500">Set a new password for <strong>{staffUsername}</strong>.</p>
      <Input
        id="staff-password"
        label="New Password"
        type="password"
        placeholder="Min. 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">Password reset successfully.</p>}
      <Button type="submit" size="sm" loading={loading}>Reset Password</Button>
    </form>
  )
}
