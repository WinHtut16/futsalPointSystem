import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = ReturnType<typeof createClient<any, any, any>>

export default async function globalTeardown() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  console.log('\n[E2E teardown] Removing test data...')

  // Delete the ephemeral customer registered during Journey 1
  const newPhone = process.env.E2E_NEW_CUSTOMER_PHONE
  if (newPhone) await deleteProfileByPhone(db, newPhone)

  // Delete the pre-seeded test customer
  const testPhone = process.env.E2E_CUSTOMER_PHONE
  if (testPhone) await deleteProfileByPhone(db, testPhone)

  // Delete the Journey 1 test reward
  const rewardName = process.env.E2E_REWARD_NAME ?? 'E2E Test Reward'
  await db.from('rewards').delete().eq('name', rewardName)

  // Journey 3 data is created and deleted within the tests themselves;
  // global-setup handles any leftovers on the next run.

  console.log('[E2E teardown] Done.\n')
}

async function deleteProfileByPhone(db: Db, phone: string) {
  const { data } = await db.from('profiles').select('id').eq('phone', phone).maybeSingle()
  if (data) {
    const { error } = await db.auth.admin.deleteUser(data.id)
    if (error) console.warn(`[E2E teardown] Could not delete profile (${phone}): ${error.message}`)
  }
}
