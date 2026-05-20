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

const ADMIN_PHONE = '09777219771'
const ADMIN_EMAIL = `${ADMIN_PHONE}@akoatp.com`
const ADMIN_PASSWORD = 'Admin@123456'

// ── 1. Create or find admin auth user ──────────────────────────────────────
console.log('Setting up admin account...')
const { data: existingUsers } = await supabase.auth.admin.listUsers()
let adminUser = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL)

if (!adminUser) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { phone: ADMIN_PHONE, username: 'Admin' },
  })
  if (error) { console.error('Create admin error:', error.message); process.exit(1) }
  adminUser = data.user
  console.log('✅ Admin auth user created:', adminUser.id)
} else {
  console.log('✅ Admin auth user already exists:', adminUser.id)
  // Update password to ensure known
  await supabase.auth.admin.updateUserById(adminUser.id, { password: ADMIN_PASSWORD })
}

// ── 2. Upsert admin profile with role = admin ─────────────────────────────
const { error: profileError } = await supabase
  .from('profiles')
  .upsert({
    id: adminUser.id,
    phone: ADMIN_PHONE,
    username: 'Admin',
    role: 'admin',
    total_points: 0,
  }, { onConflict: 'id' })

if (profileError) {
  console.error('Profile upsert error:', profileError.message)
} else {
  console.log('✅ Admin profile set (role = admin)')
}

// ── 3. Seed initial rewards ───────────────────────────────────────────────
console.log('\nSeeding rewards...')
const rewards = [
  { name: '1 Bottle Water',       description: 'Free 600ml water bottle', points_cost: 30,  stock: null },
  { name: '1 Can Juice',          description: 'Choice of juice can',      points_cost: 50,  stock: null },
  { name: '1 Energy Drink',       description: '325ml energy drink',       points_cost: 80,  stock: null },
  { name: '30 Min Free Play',     description: 'Half hour of free court time', points_cost: 150, stock: null },
  { name: '1 Hour Free Play',     description: 'One full hour of free court time', points_cost: 250, stock: null },
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

Admin login:
  Phone:    ${ADMIN_PHONE}
  Password: ${ADMIN_PASSWORD}

Go to http://localhost:3000/login
════════════════════════════════════════`)
