import { notFound } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import CmsPostForm, { type CmsPostInput } from '@/components/admin/booking/CmsPostForm'

export const dynamic = 'force-dynamic'

export default async function EditCmsPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin()
  const { id } = await params

  const supabase = createServiceClient()
  const { data } = await supabase.from('cms_posts').select('*').eq('id', id).single()
  if (!data) notFound()

  const initial: Partial<CmsPostInput> = {
    slug: data.slug,
    category: data.category,
    title: data.title,
    title_my: data.title_my ?? '',
    excerpt: data.excerpt ?? '',
    excerpt_my: data.excerpt_my ?? '',
    body_md: data.body_md ?? '',
    body_my_md: data.body_my_md ?? '',
    cover_url: data.cover_url ?? '',
    published: data.published,
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Edit post</h1>
      <CmsPostForm id={id} initial={initial} />
    </div>
  )
}
