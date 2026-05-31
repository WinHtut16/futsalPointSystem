'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { CldImage } from 'next-cloudinary'
import { ChevronRight, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

function isCloudinaryUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'res.cloudinary.com'
  } catch {
    return false
  }
}

export type NewsPost = {
  id: string
  category: 'news' | 'promotion' | 'league' | 'event'
  title: string
  titleMy?: string | null
  excerpt?: string | null
  excerptMy?: string | null
  date: string
  sourceUrl: string
  manualImageUrl?: string | null
}

const catChip: Record<NewsPost['category'], string> = {
  promotion: 'bg-accent-soft',
  league: 'bg-primary-soft text-primary',
  event: 'bg-accent-soft',
  news: 'bg-surface-alt text-ink',
}

const catAccentStyle: Record<NewsPost['category'], React.CSSProperties | undefined> = {
  promotion: { color: 'oklch(0.40 0.13 78)' },
  event: { color: 'oklch(0.40 0.13 78)' },
  league: undefined,
  news: undefined,
}

const catKey: Record<NewsPost['category'], string> = {
  news: 'booking.news.catNews',
  promotion: 'booking.news.catPromotion',
  league: 'booking.news.catLeague',
  event: 'booking.news.catEvent',
}

function PostImage({ url, className }: { url: string; className: string }) {
  if (isCloudinaryUrl(url)) {
    return (
      <CldImage
        src={url}
        alt=""
        width={800}
        height={224}
        crop="fill"
        gravity="auto"
        className={className}
      />
    )
  }
  return (
    <Image
      src={url}
      alt=""
      width={800}
      height={224}
      unoptimized
      className={className}
    />
  )
}

export default function NewsCardGrid({ posts, columns = 3 }: { posts: NewsPost[]; columns?: 2 | 3 }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [selected, setSelected] = useState<NewsPost | null>(null)
  const [show, setShow] = useState(false)

  function openPost(post: NewsPost) {
    setSelected(post)
    setTimeout(() => setShow(true), 10)
  }

  function closePost() {
    setShow(false)
    setTimeout(() => setSelected(null), 300)
  }

  if (posts.length === 0) {
    return (
      <div className="fb-card p-8 text-center text-sm text-ink-muted">
        <span className={my}>{t('booking.news.empty')}</span>
      </div>
    )
  }

  const grid = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <>
      <div className={`grid grid-cols-1 gap-4 ${grid}`}>
        {posts.map((p) => {
          const title = lang === 'my' && p.titleMy ? p.titleMy : p.title
          const excerpt = lang === 'my' && p.excerptMy ? p.excerptMy : p.excerpt
          return (
            <div
              key={p.id}
              onClick={() => openPost(p)}
              className="fb-card block cursor-pointer overflow-hidden transition-all duration-200 hover:scale-[1.01] hover:shadow-fb-md active:scale-[0.99]"
            >
              {p.manualImageUrl ? (
                <PostImage url={p.manualImageUrl} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-surface-alt">
                  <span
                    className={`fb-chip ${catChip[p.category]}`}
                    style={catAccentStyle[p.category]}
                  >
                    {t(catKey[p.category] as never)}
                  </span>
                </div>
              )}
              <div className="p-5">
                <span
                  className={`fb-chip ${catChip[p.category]}`}
                  style={catAccentStyle[p.category]}
                >
                  {t(catKey[p.category] as never)}
                </span>
                <div className={`mt-3 font-display text-base font-bold leading-snug text-ink-primary ${my}`}>
                  {title}
                </div>
                {excerpt && <div className={`mt-2 text-[13px] leading-snug text-ink-muted ${my}`}>{excerpt}</div>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-fbmono text-xs text-ink-muted">{p.date}</span>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
                    <span className={my}>{t('booking.news.readMore' as never)}</span>
                    <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <NewsPostDetail
          post={selected}
          lang={lang}
          my={my}
          show={show}
          onClose={closePost}
        />
      )}
    </>
  )
}

function NewsPostDetail({
  post,
  lang,
  my,
  show,
  onClose,
}: {
  post: NewsPost
  lang: string
  my: string
  show: boolean
  onClose: () => void
}) {
  const { t } = useLanguage()
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)

  const title = lang === 'my' && post.titleMy ? post.titleMy : post.title
  const excerpt = lang === 'my' && post.excerptMy ? post.excerptMy : post.excerpt

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (sheetRef.current) sheetRef.current.style.transform = ''
    if (dy > 80) onClose()
  }

  const postContent = (
    <>
      {post.manualImageUrl && (
        <PostImage url={post.manualImageUrl} className="h-56 max-h-56 w-full object-cover" />
      )}
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span
            className={`fb-chip ${catChip[post.category]}`}
            style={catAccentStyle[post.category]}
          >
            {t(catKey[post.category] as never)}
          </span>
          <span className="font-fbmono text-xs text-ink-muted">{post.date}</span>
        </div>
        <h2 className={`mt-3 font-display text-lg font-bold leading-snug text-ink-primary ${my}`}>{title}</h2>
        {excerpt && <p className={`mt-3 text-sm leading-relaxed text-ink ${my}`}>{excerpt}</p>}
      </div>
    </>
  )

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Mobile: bottom sheet */}
      <div
        ref={sheetRef}
        className={`md:hidden absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white transition-transform duration-300 ${show ? 'translate-y-0' : 'translate-y-full'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <button
          type="button"
          onClick={onClose}
          className="flex w-full justify-center py-3"
          aria-label="Close"
        >
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </button>
        {postContent}
        <div className="px-5 pb-6 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-line py-3 text-sm font-semibold text-ink"
          >
            <span className={my}>{t('booking.news.close' as never)}</span>
          </button>
        </div>
      </div>

      {/* Desktop: centered modal */}
      <div className="hidden md:flex absolute inset-0 items-center justify-center p-4">
        <div
          className={`relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl transition-all duration-300 ${show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-ink-muted hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          {postContent}
        </div>
      </div>
    </div>
  )
}