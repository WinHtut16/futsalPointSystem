import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { CmsPostSchema, IdParamSchema, badRequest, parseJson, serverError } from '@/lib/schemas'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyAdmin()
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const idParse = IdParamSchema.safeParse(await params)
  if (!idParse.success) return badRequest(idParse.error)
  const { id } = idParse.data

  const parsed = CmsPostSchema.safeParse(await parseJson(request))
  if (!parsed.success) return badRequest(parsed.error)
  const body = parsed.data

  const supabase = await createServiceClient()

  // Preserve the original published_at; set it the first time a post is published.
  const { data: existing } = await supabase
    .from('cms_posts')
    .select('published, published_at')
    .eq('id', id)
    .single()

  const willPublish = body.published ?? false
  const published_at =
    willPublish && !existing?.published_at ? new Date().toISOString() : existing?.published_at ?? null

  const { data: updated, error } = await supabase
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
    .select('id')
    .single()

  if (error?.code === 'PGRST116') {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
  }
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That slug is already in use.' }, { status: 409 })
    }
    return serverError(error.message)
  }
  revalidatePath('/', 'page')
  revalidatePath('/news', 'page')
  return NextResponse.json({ id: updated.id })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyAdmin()
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const idParse = IdParamSchema.safeParse(await params)
  if (!idParse.success) return badRequest(idParse.error)

  const supabase = await createServiceClient()
  const { error } = await supabase.from('cms_posts').delete().eq('id', idParse.data.id)
  if (error) return serverError(error.message)
  revalidatePath('/', 'page')
  revalidatePath('/news', 'page')
  return NextResponse.json({ ok: true })
}
