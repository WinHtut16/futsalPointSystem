import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { z } from 'zod'
import { badRequest, parseJson, serverError } from '@/lib/schemas'

const ResetCustomerPasswordSchema = z.object({
  userId: z.string().uuid(),
  tempPassword: z.string().min(8).max(72),
})

export async function POST(request: NextRequest) {
  try {
    await requireAnyAdmin()

    const body = await parseJson(request)
    const parsed = ResetCustomerPasswordSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error)

    const { userId, tempPassword } = parsed.data

    const supabase = await createServiceClient()

    // IDOR guard: only customer accounts may be reset through this endpoint
    const { data: target } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (!target || target.role !== 'customer') {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: tempPassword,
    })
    if (error) return serverError(error.message)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}