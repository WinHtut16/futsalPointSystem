'use client'

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import PasswordStrengthMeter, { calcStrength } from '@/components/ui/PasswordStrengthMeter'

interface Props {
  customerId: string
  customerName: string
}

export default function ResetPasswordForm({ customerId, customerName }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.')
      setStatus('error')
      return
    }
    if (calcStrength(password) < 2) {
      setMessage('Password is too weak. Add numbers or uppercase letters.')
      setStatus('error')
      return
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.')
      setStatus('error')
      return
    }

    setStatus('loading')
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      setStatus('success')
      setMessage(`Password for ${customerName} has been reset.`)
      setPassword('')
      setConfirm('')
    } else {
      const json = await res.json()
      setStatus('error')
      setMessage(json.error ?? 'Failed to reset password.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Input
          id="new-password"
          label="New Password"
          type="password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setStatus('idle'); setMessage('') }}
          autoComplete="new-password"
        />
        <PasswordStrengthMeter password={password} />
      </div>
      <Input
        id="confirm-password"
        label="Confirm Password"
        type="password"
        placeholder="Re-enter new password"
        value={confirm}
        onChange={(e) => { setConfirm(e.target.value); setStatus('idle'); setMessage('') }}
        autoComplete="new-password"
      />
      {message && (
        <p className={`text-sm px-3 py-2 rounded-lg ${
          status === 'success'
            ? 'text-green-700 bg-green-50'
            : 'text-red-500 bg-red-50'
        }`}>
          {message}
        </p>
      )}
      <Button type="submit" loading={status === 'loading'} className="w-full">
        Reset Password
      </Button>
    </form>
  )
}
