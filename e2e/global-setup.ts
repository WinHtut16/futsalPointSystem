import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'fs'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = ReturnType<typeof createClient<any, any, any>>

export default async function globalSetup() {
  // Re-load the env file here in case this process was launched without the config
  const envFile = path.resolve('.env.e2e')
  if (existsSync(envFile)) process.loadEnvFile(envFile)

  requireEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'E2E_SUPERADMIN_EMAIL',
    'E2E_SUPERADMIN_PASSWORD',
    'E2E_CUSTOMER_PHONE',
    'E2E_CUSTOMER_PASSWORD',
    'E2E_CUSTOMER_USERNAME',
    'E2E_NEW_CUSTOMER_PHONE',
    'E2E_NEW_CUSTOMER_PASSWORD',
  )

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const customerPhone    = process.env.E2E_CUSTOMER_PHONE!
  const customerPassword = process.env.E2E_CUSTOMER_PASSWORD!
  const customerUsername = process.env.E2E_CUSTOMER_USERNAME!
  const seedPoints       = parseInt(process.env.E2E_CUSTOMER_POINTS ?? '500', 10)
  const rewardName       = process.env.E2E_REWARD_NAME ?? 'E2E Test Reward'
  const rewardPoints     = parseInt(process.env.E2E_REWARD_POINTS ?? '100', 10)
  const newPhone         = process.env.E2E_NEW_CUSTOMER_PHONE!
  const j3StaffUsername  = process.env.E2E_STAFF_USERNAME ?? 'e2eteststaff'
  const j3RewardName     = process.env.E2E_J3_REWARD_NAME ?? 'E2E Journey3 Reward'

  console.log('\n[E2E setup] Preparing test data...')

  // 1. Remove stale ephemeral customer from a previous run
  await deleteProfileByPhone(db, newPhone)

  // 2. Remove stale Journey 3 artifacts from a previous failed run
  await deleteStaffByUsername(db, j3StaffUsername)
  await db.from('rewards').delete().eq('name', j3RewardName)

  // 3. Ensure the pre-seeded test customer exists with known credentials
  await upsertCustomer(db, customerPhone, customerPassword, customerUsername)

  // 4. Reset points to a known value so journey tests are deterministic
  const { error: ptErr } = await db
    .from('profiles')
    .update({ total_points: seedPoints })
    .eq('phone', customerPhone)
  if (ptErr) throw new Error(`[E2E setup] Failed to set test customer points: ${ptErr.message}`)

  // 5. Ensure the test reward exists and is active
  await upsertReward(db, rewardName, rewardPoints)

  // 6. Cancel any open pending redemption requests the test customer may have left
  await db
    .from('redemption_requests')
    .update({ status: 'cancelled' })
    .eq('status', 'pending')
    .in('customer_id', await getProfileId(db, customerPhone))

  console.log(`[E2E setup] Done. Customer: ${customerPhone} (${seedPoints} pts) | Reward: "${rewardName}" (${rewardPoints} pts)\n`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsertCustomer(db: Db, phone: string, password: string, username: string) {
  const email = `${phone}@akoatp.com`

  const { data: existing } = await db
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    const { error } = await db.auth.admin.updateUserById(existing.id, { password })
    if (error) throw new Error(`[E2E setup] Could not reset test customer password: ${error.message}`)
    return
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phone, username },
  })
  if (error) throw new Error(`[E2E setup] Could not create test customer: ${error.message}`)

  // Wait for the handle_new_user trigger to insert the profiles row
  if (data.user) {
    for (let i = 0; i < 10; i++) {
      const { data: p } = await db.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
      if (p) return
      await sleep(400)
    }
    throw new Error('[E2E setup] Profile row was not created by trigger within 4 s')
  }
}

async function upsertReward(db: Db, name: string, pointsCost: number) {
  const { data: existing } = await db.from('rewards').select('id').eq('name', name).maybeSingle()

  if (existing) {
    await db.from('rewards').update({ is_active: true, points_cost: pointsCost }).eq('id', existing.id)
    return
  }

  const { error } = await db.from('rewards').insert({ name, points_cost: pointsCost, is_active: true })
  if (error) throw new Error(`[E2E setup] Could not create test reward: ${error.message}`)
}

async function deleteProfileByPhone(db: Db, phone: string) {
  const { data } = await db.from('profiles').select('id').eq('phone', phone).maybeSingle()
  if (data) {
    const { error } = await db.auth.admin.deleteUser(data.id)
    if (error) console.warn(`[E2E setup] Could not delete profile (${phone}): ${error.message}`)
  }
}

async function deleteStaffByUsername(db: Db, username: string) {
  const { data } = await db
    .from('profiles')
    .select('id')
    .eq('username', username)
    .eq('role', 'admin')
    .maybeSingle()
  if (data) {
    const { error } = await db.auth.admin.deleteUser(data.id)
    if (error) console.warn(`[E2E setup] Could not delete staff (${username}): ${error.message}`)
  }
}

async function getProfileId(db: Db, phone: string): Promise<string[]> {
  const { data } = await db.from('profiles').select('id').eq('phone', phone).maybeSingle()
  return data ? [data.id] : []
}

function requireEnv(...keys: string[]) {
  const missing = keys.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(`[E2E setup] Missing required env vars:\n  ${missing.join('\n  ')}\n\nCopy .env.e2e.example → .env.e2e and fill in the blanks.`)
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
