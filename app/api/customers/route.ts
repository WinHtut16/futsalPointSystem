import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { CustomersQuerySchema, badRequest, serverError } from '@/lib/schemas'

export async function GET(request: NextRequest) {
  try {
    await requireAnyAdmin()

    const { searchParams } = new URL(request.url)
    const phoneParam = searchParams.get('phone')
    const parsed = CustomersQuerySchema.safeParse(
      phoneParam === null ? {} : { phone: phoneParam }
    )
    if (!parsed.success) return badRequest(parsed.error)
    const { phone } = parsed.data

    const supabase = await createServiceClient()
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })

    if (phone) query = query.ilike('phone', `%${phone}%`)

    const { data, error } = await query.limit(50)
    if (error) return serverError(error.message)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
