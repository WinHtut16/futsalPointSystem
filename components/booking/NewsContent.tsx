'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import SiteNavbar from './SiteNavbar'
import BottomNav from './BottomNav'
import SectionLabel from './SectionLabel'
import NewsCardGrid, { type NewsPost } from './NewsCardGrid'

type Cat = 'all' | NewsPost['category']
const CATS: { k: Cat; key: string }[] = [
  { k: 'all', key: 'booking.news.all' },
  { k: 'news', key: 'booking.news.catNews' },
  { k: 'promotion', key: 'booking.news.catPromotion' },
  { k: 'league', key: 'booking.news.catLeague' },
  { k: 'event', key: 'booking.news.catEvent' },
]

export default function NewsContent({ posts }: { posts: NewsPost[] }) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const [cat, setCat] = useState<Cat>('all')
  const visible = cat === 'all' ? posts : posts.filter((p) => p.category === cat)

  return (
    <>
      <SiteNavbar active="news" mobileTitle={t('booking.news.title')} />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:px-16 md:pt-10">
        <div className="hidden md:block">
          <SectionLabel kicker={t('booking.news.title')} title={t('booking.news.whatsOn')} />
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto">
          {CATS.map(({ k, key }) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 font-display text-xs font-semibold ${my} ${
                cat === k ? 'border-transparent bg-primary text-primary-on' : 'border-line bg-surface text-ink-muted'
              }`}
            >
              {t(key as never)}
            </button>
          ))}
        </div>

        <NewsCardGrid posts={visible} columns={3} />
      </div>
      <BottomNav active="news" />
    </>
  )
}
