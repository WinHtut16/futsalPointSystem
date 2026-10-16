import { createServiceClient } from '@/lib/supabase/server'
import HomeContent from '@/components/booking/HomeContent'
import type { NewsPost } from '@/components/booking/NewsCardGrid'

export const dynamic = 'force-dynamic'

// Sample fallback so the homepage renders before any CMS post exists
// (and if the cms_posts table isn't migrated yet in this environment).
const SAMPLE_POSTS: NewsPost[] = [
  { id: 's1', category: 'promotion', title: 'Member week · 10% off all weekend hours', titleMy: 'မက်ဘာအပတ် · ပိတ်ရက်တိုင်း ၁၀% လျှော့', excerpt: 'A six-day window for Silver and Gold members.', excerptMy: 'Silver နှင့် Gold မက်ဘာများအတွက်။', date: 'Jun 2 – Jun 8', sourceUrl: '#', manualImageUrl: null },
  { id: 's2', category: 'league', title: 'Friday Night League — Season 4 sign-ups open', titleMy: 'သောကြာညပြိုင်ပွဲ — Season ၄ ဖွင့်ပြီ', excerpt: '8 teams. 7 weeks. A trophy for the champion.', excerptMy: 'အသင်း ၈ သင်း။ ၇ ပတ်။', date: 'Until Jun 14', sourceUrl: '#', manualImageUrl: null },
  { id: 's3', category: 'news', title: 'New turf install — Molten Vantaggio match balls', titleMy: 'ဘောလုံးအသစ်နှင့် ကွင်းအသစ်', excerpt: 'We swapped to a tighter weave artificial turf.', excerptMy: 'ပိုကောင်းတဲ့ ပိုက်အသစ် ပြောင်းပြီးပါပြီ။', date: 'May 22', sourceUrl: '#', manualImageUrl: null },
]

async function getPosts(): Promise<NewsPost[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('cms_posts')
      .select('id, category, title, title_my, excerpt, excerpt_my, source_url, manual_image_url, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(5)
    if (error || !data || data.length === 0) return SAMPLE_POSTS
    return data.map((p) => ({
      id: p.id,
      category: p.category,
      title: p.title,
      titleMy: p.title_my,
      excerpt: p.excerpt,
      excerptMy: p.excerpt_my,
      date: p.published_at ? new Date(p.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      sourceUrl: p.source_url ?? '',
      manualImageUrl: p.manual_image_url,
    }))
  } catch {
    return SAMPLE_POSTS
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ logged_out?: string }> }) {
  const sp = await searchParams
  const posts = await getPosts()
  return <HomeContent posts={posts} loggedOut={sp.logged_out === '1'} />
}
