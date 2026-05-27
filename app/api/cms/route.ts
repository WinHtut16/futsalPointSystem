import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { CmsPostSchema, badRequest, parseJson } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  let admin
  try {
    admin = await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = CmsPostSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const body = parsed.data

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('cms_posts')
    .insert({
      slug: body.slug,
      category: body.category,
      title: body.title,
      title_my: body.title_my ?? null,
      excerpt: body.excerpt ?? null,
      excerpt_my: body.excerpt_my ?? null,
      body_md: body.body_md ?? null,
      body_my_md: body.body_my_md ?? null,
      cover_url: body.cover_url ?? null,
      published: body.published ?? false,
      published_at: body.published ? new Date().toISOString() : null,
      created_by: admin.id,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data?.id })
}
