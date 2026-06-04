import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth'
import { CmsPostSchema, IdParamSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const idParse = IdParamSchema.safeParse(await params)
  if (!idParse.success) return badRequest(idParse.error)
  const { id } = idParse.data

  const parsed = CmsPostSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const body = parsed.data

  const supabase = createServiceClient()

  // Preserve the original published_at; set it the first time a post is published.
  const { data: existing } = await supabase
    .from('cms_posts')
    .select('published, published_at')
    .eq('id', id)
    .single()

  const willPublish = body.published ?? false
  const published_at =
    willPublish && !existing?.published_at ? new Date().toISOString() : existing?.published_at ?? null

  const { error } = await supabase
    .from('cms_posts')
    .update({
      slug: body.slug,
      category: body.category,
      title: body.title,
      title_my: body.title_my ?? null,
      excerpt: body.excerpt ?? null,
      excerpt_my: body.excerpt_my ?? null,
      source_url: body.source_url ?? null,
      manual_image_url: body.manual_image_url ?? null,
      published: willPublish,
      published_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 })
    }
    return serverError(error.message)
  }
  return NextResponse.json({ id })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const idParse = IdParamSchema.safeParse(await params)
  if (!idParse.success) return badRequest(idParse.error)

  const supabase = createServiceClient()
  const { error } = await supabase.from('cms_posts').delete().eq('id', idParse.data.id)
  if (error) return serverError(error.message)
  return NextResponse.json({ ok: true })
}
