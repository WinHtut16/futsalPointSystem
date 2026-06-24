import { requireAnyAdmin } from '@/lib/auth'
import CmsPostForm from '@/components/admin/booking/CmsPostForm'

export const dynamic = 'force-dynamic'

export default async function NewCmsPostPage() {
  await requireAnyAdmin()
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">New post</h1>
      <CmsPostForm />
    </div>
  )
}
