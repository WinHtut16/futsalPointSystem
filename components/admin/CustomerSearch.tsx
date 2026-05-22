'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function CustomerSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(defaultValue)
  const { t } = useLanguage()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (value.trim()) params.set('q', value.trim())
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder={t('admin.searchByPhone')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="tel"
      />
      <Button type="submit" size="md">{t('admin.searchButton')}</Button>
    </form>
  )
}
