// Run with: node --env-file=.env.local setup-admin.mjs
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars. Run: node --env-file=.env.local setup-admin.mjs')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Superadmin account config ──────────────────────────────────────────────
// Set these to the owner's real email and desired username/password.
const SUPERADMIN_EMAIL    = process.env.SUPERADMIN_EMAIL    || 'winhtutcentury@gmail.com'
const SUPERADMIN_USERNAME = process.env.SUPERADMIN_USERNAME || 'Owner'
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'WinHtutNaingAIT1673@'
const SUPERADMIN_PHONE    = process.env.SUPERADMIN_PHONE    || '09777219771'

// ── 1. Create or find superadmin auth user ─────────────────────────────────
console.log('Setting up superadmin account...')
const { data: existingUsers } = await supabase.auth.admin.listUsers()
let adminUser = existingUsers?.users?.find(u => u.email === SUPERADMIN_EMAIL)

// Also look for the old phone-based email in case migrating from previous setup
const OLD_ADMIN_EMAIL = existingUsers?.users?.find(
  u => u.email?.endsWith('@akoatp.com') && u.email !== SUPERADMIN_EMAIL
)

if (!adminUser && OLD_ADMIN_EMAIL) {
  console.log(`Migrating existing admin from ${OLD_ADMIN_EMAIL.email} → ${SUPERADMIN_EMAIL}`)
  const { error } = await supabase.auth.admin.updateUserById(OLD_ADMIN_EMAIL.id, {
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  })
  if (error) { console.error('Migration error:', error.message); process.exit(1) }
  adminUser = OLD_ADMIN_EMAIL
  console.log('✅ Superadmin email updated')
}

if (!adminUser) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { phone: SUPERADMIN_PHONE, username: SUPERADMIN_USERNAME },
  })
  if (error) { console.error('Create superadmin error:', error.message); process.exit(1) }
  adminUser = data.user
  console.log('✅ Superadmin auth user created:', adminUser.id)
} else {
  console.log('✅ Superadmin auth user found:', adminUser.id)
  await supabase.auth.admin.updateUserById(adminUser.id, { password: SUPERADMIN_PASSWORD })
}

// ── 2. Upsert superadmin profile with role = superadmin ────────────────────
// Check if profile already exists; if so, only update role/username (not phone)
const { data: existingProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', adminUser.id)
  .maybeSingle()

let profileError
if (existingProfile) {
  const { error } = await supabase
    .from('profiles')
    .update({ username: SUPERADMIN_USERNAME, role: 'superadmin' })
    .eq('id', adminUser.id)
  profileError = error
} else {
  const { error } = await supabase
    .from('profiles')
    .insert({
      id: adminUser.id,
      phone: SUPERADMIN_PHONE,
      username: SUPERADMIN_USERNAME,
      role: 'superadmin',
      total_points: 0,
    })
  profileError = error
}

if (profileError) {
  console.error('Profile upsert error:', profileError.message)
} else {
  console.log('✅ Superadmin profile set (role = superadmin)')
}

// ── 3. Seed initial rewards ────────────────────────────────────────────────
console.log('\nSeeding rewards...')
const rewards = [
  { name: '1 Bottle Water',       description: 'Free 600ml water bottle',           points_cost: 30,  stock: null },
  { name: '1 Can Juice',          description: 'Choice of juice can',                points_cost: 50,  stock: null },
  { name: '1 Energy Drink',       description: '325ml energy drink',                 points_cost: 80,  stock: null },
  { name: '30 Min Free Play',     description: 'Half hour of free court time',       points_cost: 150, stock: null },
  { name: '1 Hour Free Play',     description: 'One full hour of free court time',   points_cost: 250, stock: null },
  { name: 'Team Discount 20%',    description: '20% off next booking for your team', points_cost: 400, stock: null },
]

const { data: existing } = await supabase.from('rewards').select('name')
const existingNames = existing?.map(r => r.name) ?? []

for (const reward of rewards) {
  if (existingNames.includes(reward.name)) {
    console.log(`  ⏭  Skipped (exists): ${reward.name}`)
    continue
  }
  const { error } = await supabase.from('rewards').insert(reward)
  if (error) console.log(`  ❌ ${reward.name}:`, error.message)
  else console.log(`  ✅ Created: ${reward.name} (${reward.points_cost} pts)`)
}

console.log(`
════════════════════════════════════════
✅ Setup complete!

Superadmin login:
  Email:    ${SUPERADMIN_EMAIL}
  Password: ${SUPERADMIN_PASSWORD}

Go to http://localhost:3000/admin/login
════════════════════════════════════════`)
