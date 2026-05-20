'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { POINTS_PER_HOUR, calculatePoints } from '@/lib/points'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

interface AddPointsFormProps {
  customerId: string
  customerName: string
}

export default function AddPointsForm({ customerId, customerName }: AddPointsFormProps) {
  const router = useRouter()
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const hoursNum = parseFloat(hours) || 0
  const preview = hoursNum > 0 ? calculatePoints(hoursNum) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (hoursNum <= 0 || hoursNum > 24) {
      setError('Enter valid hours (0.5 – 24).')
      return
    }

    setLoading(true)
    const res = await fetch('/api/points/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId, hours_played: hoursNum, note }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to add points.')
      return
    }

    setSuccess(`Added ${data.points_added} points to ${customerName}.`)
    setHours('')
    setNote('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="hours"
        label={`Hours Played (${POINTS_PER_HOUR} pts/hr)`}
        type="number"
        step="0.5"
        min="0.5"
        max="24"
        placeholder="e.g. 1.5"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        required
      />
      {preview > 0 && (
        <p className="text-sm text-brand-600 font-medium bg-brand-50 px-3 py-2 rounded-lg">
          Will add <strong>{preview} points</strong> for {hoursNum}h of play
        </p>
      )}
      <Input
        id="note"
        label="Note (optional)"
        type="text"
        placeholder="e.g. Weekend session"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={100}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && <p className="text-sm text-green-600 font-medium">{success}</p>}
      <Button type="submit" size="lg" loading={loading}>
        Add Points
      </Button>
    </form>
  )
}
