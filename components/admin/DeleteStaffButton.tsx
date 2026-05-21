'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

interface Props {
  staffId: string
  staffUsername: string
}

export default function DeleteStaffButton({ staffId, staffUsername }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (!confirm(`Delete admin account "${staffUsername}"? This cannot be undone.`)) return
    setError('')
    setLoading(true)

    const res = await fetch(`/api/admin/staff/${staffId}`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to delete admin.')
      setLoading(false)
      return
    }

    router.push('/admin/staff')
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">
        Permanently remove this admin account. They will lose access immediately.
      </p>
      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <Button variant="danger" size="sm" loading={loading} onClick={handleDelete}>
        Delete Admin Account
      </Button>
    </div>
  )
}
