'use client'

import { ExternalLink } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

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

const catKey: Record<NewsPost['category'], string> = {
  news: 'booking.news.catNews',
  promotion: 'booking.news.catPromotion',
  league: 'booking.news.catLeague',
  event: 'booking.news.catEvent',
}

export default function NewsCardGrid({ posts, columns = 3 }: { posts: NewsPost[]; columns?: 2 | 3 }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  if (posts.length === 0) {
    return (
      <div className="fb-card p-8 text-center text-sm text-ink-muted">
        <span className={my}>{t('booking.news.empty')}</span>
      </div>
    )
  }

  const grid = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={`grid grid-cols-1 gap-4 ${grid}`}>
      {posts.map((p) => {
        const title = lang === 'my' && p.titleMy ? p.titleMy : p.title
        const excerpt = lang === 'my' && p.excerptMy ? p.excerptMy : p.excerpt
        return (
          <a
            key={p.id}
            href={p.sourceUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="fb-card block overflow-hidden"
          >
            {p.manualImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.manualImageUrl} alt="" className="h-44 w-full object-cover" />
            ) : (
              <div className="flex h-44 w-full items-center justify-center bg-surface-alt">
                <span
                  className={`fb-chip ${catChip[p.category]}`}
                  style={p.category === 'promotion' || p.category === 'event' ? { color: 'oklch(0.40 0.13 78)' } : undefined}
                >
                  {t(catKey[p.category] as never)}
                </span>
              </div>
            )}
            <div className="p-5">
              <span
                className={`fb-chip ${catChip[p.category]}`}
                style={p.category === 'promotion' || p.category === 'event' ? { color: 'oklch(0.40 0.13 78)' } : undefined}
              >
                {t(catKey[p.category] as never)}
              </span>
              <div className={`mt-3 font-display text-base font-bold leading-snug text-ink-primary ${my}`}>
                {title}
              </div>
              {excerpt && <div className={`mt-2 text-[13px] leading-snug text-ink-muted ${my}`}>{excerpt}</div>}
              <div className="mt-3 flex items-center justify-between">
                <span className="font-fbmono text-xs text-ink-muted">{p.date}</span>
                <ExternalLink size={14} className="text-ink-muted" />
              </div>
            </div>
          </a>
        )
      })}
    </div>
  )
}
