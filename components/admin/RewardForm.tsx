'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { Reward } from '@/types'

interface RewardFormProps {
  reward?: Reward
  mode?: 'create' | 'edit'
}

export default function RewardForm({ reward, mode = 'create' }: RewardFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: reward?.name ?? '',
    name_my: reward?.name_my ?? '',
    description: reward?.description ?? '',
    description_my: reward?.description_my ?? '',
    points_cost: reward?.points_cost?.toString() ?? '',
    stock: reward?.stock?.toString() ?? '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cost = parseInt(form.points_cost)
    if (!form.name.trim() || cost <= 0) {
      setError(t('admin.rewardValidationError'))
      return
    }

    setLoading(true)
    const url = mode === 'edit' ? `/api/rewards/${reward!.id}` : '/api/rewards'
    const method = mode === 'edit' ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        name_my: form.name_my.trim() || null,
        description: form.description.trim() || null,
        description_my: form.description_my.trim() || null,
        points_cost: cost,
        stock: form.stock ? parseInt(form.stock) : null,
      }),
    })
    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? t('admin.rewardValidationError'))
      return
    }

    router.push('/admin/rewards')
    router.refresh()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="name"
          label={t('admin.rewardNameLabel')}
          placeholder={t('admin.rewardNamePlaceholder')}
          value={form.name}
          onChange={set('name')}
          required
          maxLength={100}
        />
        <Input
          id="name_my"
          label={t('admin.rewardNameMYLabel')}
          placeholder={t('admin.rewardNameMYPlaceholder')}
          value={form.name_my}
          onChange={set('name_my')}
          maxLength={100}
        />
        <Input
          id="description"
          label={t('admin.rewardDescLabel')}
          placeholder={t('admin.rewardDescPlaceholder')}
          value={form.description}
          onChange={set('description')}
          maxLength={1000}
        />
        <Input
          id="description_my"
          label={t('admin.rewardDescMYLabel')}
          placeholder={t('admin.rewardDescMYPlaceholder')}
          value={form.description_my}
          onChange={set('description_my')}
          maxLength={1000}
        />
        <Input
          id="points_cost"
          label={t('admin.rewardPointsLabel')}
          type="number"
          min="1"
          placeholder={t('admin.rewardPointsPlaceholder')}
          value={form.points_cost}
          onChange={set('points_cost')}
          required
        />
        <Input
          id="stock"
          label={t('admin.rewardStockLabel')}
          type="number"
          min="0"
          placeholder={t('admin.rewardStockPlaceholder')}
          value={form.stock}
          onChange={set('stock')}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="flex-1"
            onClick={() => router.back()}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="md" loading={loading} className="flex-1">
            {mode === 'edit' ? t('admin.saveChanges') : t('admin.createReward')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
