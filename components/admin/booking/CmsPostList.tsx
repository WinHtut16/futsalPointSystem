'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type CmsPostRow = {
  id: string
  slug: string
  category: string
  title: string
  published: boolean
}

export default function CmsPostList({ initial }: { initial: CmsPostRow[] }) {
  const { t } = useLanguage()
  const [rows, setRows] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  async function remove(id: string) {
    if (!confirm('Delete this post?')) return
    setBusy(id)
    try {
      const res = await fetch(`/api/cms/${id}`, { method: 'DELETE' })
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setBusy(null)
    }
  }

  if (rows.length === 0) {
    return <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-400 shadow-sm">{t('booking.admin.noPostsYet')}</p>
  }

  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">{p.category}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {p.published ? t('booking.admin.published') : t('booking.admin.draft')}
              </span>
            </div>
            <p className="mt-1 truncate font-semibold text-gray-900">{p.title}</p>
            <p className="truncate font-mono text-xs text-gray-400">{p.slug}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href={`/admin/cms/${p.id}/edit`} className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50" aria-label={t('booking.admin.edit')}>
              <Pencil className="h-4 w-4" />
            </Link>
            <button onClick={() => remove(p.id)} disabled={busy === p.id} className="rounded-lg border border-gray-300 p-2 text-red-600 hover:bg-red-50" aria-label={t('booking.admin.delete')}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}