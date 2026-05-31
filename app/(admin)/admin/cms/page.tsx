import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireSuperAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import CmsPostList, { type CmsPostRow } from '@/components/admin/booking/CmsPostList'

export const dynamic = 'force-dynamic'

export default async function AdminCmsPage() {
  await requireSuperAdmin()

  let rows: CmsPostRow[] = []
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('cms_posts')
      .select('id, slug, category, title, published')
      .order('created_at', { ascending: false })
    rows = (data ?? []) as CmsPostRow[]
  } catch {
    // Booking tables not migrated yet.
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">CMS posts</h1>
        <Link href="/admin/cms/new" className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
          <Plus className="h-4 w-4" /> New post
        </Link>
      </div>
      <CmsPostList initial={rows} />
    </div>
  )
}
