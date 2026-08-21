import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/server'
import { phoneToEmail, normalizePhone } from '@/lib/utils'
import { RegisterSchema, badRequest, parseJson } from '@/lib/schemas'

export const maxDuration = 15

/**
 * Registration is IDEMPOTENT and establishes the session server-side.
 *
 * Why: on a heavily degraded link (Myanmar's DPI currently passes uploads at full
 * speed while crippling the download direction) the POST reliably *reaches* us and
 * the account really is created — it is the 201 that never makes it back. The client
 * then times out and retries. A naive "phone already exists -> 409" turns that
 * successful signup into "This phone number is already registered", which is exactly
 * the bug customers reported.
 *
 * Two properties fix it:
 *
 *  1. A duplicate phone is not automatically a conflict. We first try the submitted
 *     password against the existing account. If it matches, this is our own retry
 *     landing on an attempt that already succeeded -> report success. Only a password
 *     MISMATCH means the number genuinely belongs to somebody else -> 409.
 *     (This gives the endpoint login-equivalent power for an existing account, which
 *     is no more than /login already offers; Supabase rate-limits the auth endpoint.)
 *
 *  2. The sign-in happens HERE, and its cookies ride back on this same response.
 *     Previously the browser had to complete a second, independent round trip to
 *     *.supabase.co before it was logged in. Two required round trips over a lossy
 *     path multiply their failure rates; one does not.
 */

export async function POST(request: NextRequest) {
  const body = await parseJson(request)
  const parsed = RegisterSchema.safeParse(
    body && typeof body === 'object'
      ? { ...body, phone: typeof (body as { phone?: unknown }).phone === 'string' ? normalizePhone((body as { phone: string }).phone) : (body as { phone?: unknown }).phone }
      : body
  )
  if (!parsed.success) return badRequest(parsed.error)
  const { phone, username, password } = parsed.data
  const email = phoneToEmail(phone)

  // Session cookies are buffered rather than written straight onto a response,
  // because the status code isn't known until after the sign-in attempt. Same
  // constraint as app/auth/callback/route.ts: createClient() from
  // lib/supabase/server.ts writes to cookies() from next/headers, which never
  // reaches the NextResponse a Route Handler returns.
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = []

  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet)
        },
      },
    }
  )

  function withSession(payload: Record<string, unknown>, status: number) {
    const response = NextResponse.json(payload, { status })
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options)
    }
    return response
  }

  const alreadyTaken = () =>
    NextResponse.json({ error: 'This phone number is already registered.' }, { status: 409 })

  /**
   * Reached when the phone already has an account. Distinguishes "our own retry"
   * from "somebody else's number" by whether the submitted password authenticates.
   */
  async function recoverOrReject() {
    const { error } = await authClient.auth.signInWithPassword({ email, password })
    if (error) return alreadyTaken()
    return withSession({ success: true, session: true, recovered: true }, 200)
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) return recoverOrReject()

  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phone, username: username.trim() },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    // Lost the race against our own in-flight first attempt (the profiles check
    // above ran before that attempt committed). Same recovery path.
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return recoverOrReject()
    }
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }

  // Log the brand-new account in here so the browser needs no further network call.
  // `session: false` tells the client to fall back to signing in itself.
  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password })

  return withSession({ success: true, session: !signInError }, 201)
}
