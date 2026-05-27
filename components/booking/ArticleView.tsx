'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'
import SiteNavbar from './SiteNavbar'
import BottomNav from './BottomNav'

export type Article = {
  category: 'news' | 'promotion' | 'league' | 'event'
  title: string
  titleMy?: string | null
  bodyMd?: string | null
  bodyMyMd?: string | null
  coverUrl?: string | null
  date: string
}

const catKey: Record<Article['category'], string> = {
  news: 'booking.news.catNews',
  promotion: 'booking.news.catPromotion',
  league: 'booking.news.catLeague',
  event: 'booking.news.catEvent',
}

export default function ArticleView({ article }: { article: Article }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const title = lang === 'my' && article.titleMy ? article.titleMy : article.title
  const body = (lang === 'my' && article.bodyMyMd ? article.bodyMyMd : article.bodyMd) ?? ''
  // Minimal, injection-safe rendering: split on blank lines into paragraphs.
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  return (
    <>
      <SiteNavbar active="news" mobileTitle={t('booking.news.title')} back />
      <article className="mx-auto max-w-2xl px-4 pb-24 pt-5 md:pt-10">
        {article.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.coverUrl} alt="" className="h-56 w-full rounded-[var(--r-lg)] object-cover" />
        ) : (
          <div className="fb-photo h-56 w-full rounded-[var(--r-lg)]" data-photo={article.category} />
        )}

        <div className="mt-4 flex items-center gap-3">
          <span className="fb-chip bg-surface-alt text-ink">{t(catKey[article.category] as never)}</span>
          <span className="font-fbmono text-xs text-ink-muted">{article.date}</span>
        </div>

        <h1 className={`mt-3 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink-primary md:text-3xl ${my}`}>
          {title}
        </h1>

        <div className="mt-5 flex flex-col gap-4">
          {paragraphs.length === 0 ? (
            <p className={`text-ink-muted ${my}`}>—</p>
          ) : (
            paragraphs.map((p, i) => (
              <p key={i} className={`whitespace-pre-line text-[15px] leading-relaxed text-ink ${my}`}>
                {p}
              </p>
            ))
          )}
        </div>
      </article>
      <BottomNav active="news" />
    </>
  )
}
