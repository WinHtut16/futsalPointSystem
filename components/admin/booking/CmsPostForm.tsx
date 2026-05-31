'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

export type CmsPostInput = {
  slug: string
  category: 'news' | 'promotion' | 'league' | 'event'
  title: string
  title_my: string
  excerpt: string
  excerpt_my: string
  manual_image_url: string
  published: boolean
}

const EMPTY: CmsPostInput = {
  slug: '', category: 'news', title: '', title_my: '', excerpt: '', excerpt_my: '',
  manual_image_url: '', published: false,
}

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'
const labelCls = 'mb-1 block text-xs font-semibold text-gray-600'
const helpCls = 'mt-1 text-[11px] text-gray-400'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default function CmsPostForm({ id, initial }: { id?: string; initial?: Partial<CmsPostInput> }) {
  const router = useRouter()
  const [form, setForm] = useState<CmsPostInput>({ ...EMPTY, ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showUrlFallback, setShowUrlFallback] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof CmsPostInput>(k: K, v: CmsPostInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!e.target.files) return
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError('Only JPG, PNG and WebP images are allowed.')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError('File too large. Maximum size is 5MB.')
      return
    }

    setUploadError(null)
    setUploading(true)

    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/cms/upload-image', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed. Please try again.')
        return
      }
      set('manual_image_url', json.url)
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function removeImage() {
    set('manual_image_url', '')
    setUploadError(null)
  }

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

      {/* Cover image upload */}
      <div>
        <span className={labelCls}>Cover image</span>

        {form.manual_image_url && !uploading ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.manual_image_url}
              alt="Cover preview"
              className="h-48 w-full rounded-lg object-cover"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Change image
              </button>
              <button
                type="button"
                onClick={removeImage}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500 transition hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-gray-400" />
                <span>Click to upload image</span>
                <span className="text-[11px] text-gray-400">JPG, PNG or WebP · max 5MB</span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploadError && (
          <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>
        )}

        {/* Fallback: paste URL */}
        <button
          type="button"
          onClick={() => setShowUrlFallback((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600"
        >
          {showUrlFallback ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showUrlFallback ? 'Use upload instead' : 'Or use an image URL instead'}
        </button>

        {showUrlFallback && (
          <div className="mt-1.5">
            <input
              className={field}
              type="url"
              value={form.manual_image_url}
              onChange={(e) => set('manual_image_url', e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            <p className={helpCls}>If left blank, a default placeholder will be shown.</p>
          </div>
        )}
      </div>

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