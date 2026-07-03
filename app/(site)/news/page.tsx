import { createServiceClient } from '@/lib/supabase/server'
import NewsContent from '@/components/booking/NewsContent'
import type { NewsPost } from '@/components/booking/NewsCardGrid'

export const dynamic = 'force-dynamic'

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

export default async function NewsPage() {
  let posts: NewsPost[] = []
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('cms_posts')
      .select('id, category, title, title_my, excerpt, excerpt_my, source_url, manual_image_url, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
    posts = (data ?? []).map((p) => ({
      id: p.id,
      category: p.category,
      title: p.title,
      titleMy: p.title_my,
      excerpt: p.excerpt,
      excerptMy: p.excerpt_my,
      sourceUrl: p.source_url ?? '',
      manualImageUrl: p.manual_image_url,
      date: fmt(p.published_at),
    }))
  } catch {
    // Booking tables not migrated yet.
  }

  return <NewsContent posts={posts} />
}
