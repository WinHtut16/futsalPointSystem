import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

// Test-only endpoint — purges the rewards unstable_cache so E2E tests see fresh data.
// Returns 403 in production so it is safe to deploy.
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  revalidateTag('rewards', 'default')
  return NextResponse.json({ ok: true })
}
