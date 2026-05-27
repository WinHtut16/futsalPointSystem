import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import ArticleView, { type Article } from '@/components/booking/ArticleView'

export const dynamic = 'force-dynamic'

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let article: Article | null = null
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('cms_posts')
      .select('category, title, title_my, body_md, body_my_md, cover_url, published, published_at')
      .eq('slug', slug)
      .eq('published', true)
      .single()
    if (data) {
      article = {
        category: data.category,
        title: data.title,
        titleMy: data.title_my,
        bodyMd: data.body_md,
        bodyMyMd: data.body_my_md,
        coverUrl: data.cover_url,
        date: data.published_at
          ? new Date(data.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '',
      }
    }
  } catch {
    // Booking tables not migrated yet.
  }

  if (!article) notFound()
  return <ArticleView article={article} />
}
