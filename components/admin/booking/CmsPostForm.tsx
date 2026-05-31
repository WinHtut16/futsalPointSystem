'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type CmsPostInput = {
  slug: string
  category: 'news' | 'promotion' | 'league' | 'event'
  title: string
  title_my: string
  excerpt: string
  excerpt_my: string
  source_url: string
  manual_image_url: string
  published: boolean
}

const EMPTY: CmsPostInput = {
  slug: '', category: 'news', title: '', title_my: '', excerpt: '', excerpt_my: '',
  source_url: '', manual_image_url: '', published: false,
}

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'
const labelCls = 'mb-1 block text-xs font-semibold text-gray-600'
const helpCls = 'mt-1 text-[11px] text-gray-400'

export default function CmsPostForm({ id, initial }: { id?: string; initial?: Partial<CmsPostInput> }) {
  const router = useRouter()
  const [form, setForm] = useState<CmsPostInput>({ ...EMPTY, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof CmsPostInput>(k: K, v: CmsPostInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(id ? `/api/cms/${id}` : '/api/cms', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save.')
        return
      }
      router.push('/admin/cms')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Slug</span>
          <input className={field} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="member-week" required />
        </label>
        <label className="block">
          <span className={labelCls}>Category</span>
          <select className={field} value={form.category} onChange={(e) => set('category', e.target.value as CmsPostInput['category'])}>
            <option value="news">News</option>
            <option value="promotion">Promotion</option>
            <option value="league">League</option>
            <option value="event">Event</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className={labelCls}>Title (EN)</span>
        <input className={field} value={form.title} onChange={(e) => set('title', e.target.value)} required />
      </label>
      <label className="block">
        <span className={labelCls}>Title (MY)</span>
        <input className={`${field} font-my`} value={form.title_my} onChange={(e) => set('title_my', e.target.value)} />
      </label>

      <label className="block">
        <span className={labelCls}>Short excerpt (EN)</span>
        <textarea
          className={field}
          maxLength={160}
          rows={2}
          value={form.excerpt}
          onChange={(e) => set('excerpt', e.target.value)}
        />
        <span className={helpCls}>{form.excerpt.length}/160</span>
      </label>
      <label className="block">
        <span className={labelCls}>Short excerpt (MY)</span>
        <textarea
          className={`${field} font-my`}
          maxLength={160}
          rows={2}
          value={form.excerpt_my}
          onChange={(e) => set('excerpt_my', e.target.value)}
        />
        <span className={helpCls}>{form.excerpt_my.length}/160</span>
      </label>

      <label className="block">
        <span className={labelCls}>Facebook / External URL *</span>
        <input
          className={field}
          type="url"
          value={form.source_url}
          onChange={(e) => set('source_url', e.target.value)}
          placeholder="https://www.facebook.com/..."
          required
        />
        <p className={helpCls}>Users will be taken to this link when they click the post.</p>
      </label>

      <label className="block">
        <span className={labelCls}>Cover image URL</span>
        <input
          className={field}
          type="url"
          value={form.manual_image_url}
          onChange={(e) => set('manual_image_url', e.target.value)}
          placeholder="Paste an image URL or leave blank"
        />
        <p className={helpCls}>If left blank, a default placeholder will be shown.</p>
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="h-4 w-4" />
        <span className="text-sm font-medium text-gray-700">Published</span>
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
          {id ? 'Save changes' : 'Create post'}
        </button>
        <button type="button" onClick={() => router.push('/admin/cms')} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
