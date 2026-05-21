# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at localhost:3000
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

**First-time setup:**
1. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
2. Run `supabase-setup.sql` then `supabase-fix-rls.sql` in the Supabase SQL editor
3. Run `node --env-file=.env.local setup-admin.mjs` to seed the admin account and rewards

## Architecture

**Stack:** Next.js 16 App Router, TypeScript, Supabase (auth + DB), Tailwind CSS

### Route Groups

- `app/(auth)/` — public login/register pages
- `app/(customer)/` — customer-facing dashboard, history, rewards (protected, `customer` role)
- `app/(admin)/` — admin dashboard, customer management, rewards (protected, `admin` role)
- `app/api/` — REST API endpoints; all mutating endpoints verify session and role server-side

`middleware.ts` handles route protection and role-based redirects before any page renders.

### Auth Flow

Supabase Auth with email derived from phone number (`{phone}@akoatp.com`). Registration goes through `/api/auth/register` which uses the service role client to bypass email confirmation. Sessions are managed SSR-side via cookie-based tokens.

Two roles — `customer` and `admin` — stored in the `profiles` table. `requireRole()` in `lib/auth.ts` is the canonical server-side guard.

### Database

All tables have Row-Level Security enforced. Key patterns:
- `is_admin()` is a `SECURITY DEFINER` function used in RLS policies to avoid infinite recursion when policies on `profiles` would otherwise re-query `profiles`.
- `add_points_transaction()` is an RPC function that atomically increments `profiles.total_points` and inserts into `point_transactions`. Always call this via Supabase RPC — never do the two steps separately.
- `handle_new_user()` trigger auto-creates a `profiles` row when a new `auth.users` entry is inserted.

**Tables:** `profiles`, `point_transactions`, `rewards`

### Key Lib Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | `getCurrentUser()`, `requireRole()` — server-side auth helpers |
| `lib/points.ts` | `calculatePoints()` — 10 points per hour |
| `lib/supabase/client.ts` | Browser Supabase client (for client components) |
| `lib/supabase/server.ts` | SSR Supabase client (for server components and API routes) |
| `lib/supabase/service.ts` | Service role client (admin operations, bypasses RLS) |

### Component Organization

- `components/auth/` — LoginForm, RegisterForm
- `components/customer/` — PointsCard, RewardCard, TransactionItem, CustomerNav
- `components/admin/` — AddPointsForm, CustomerSearch, RewardForm, ResetPasswordForm, DeleteCustomerButton
- `components/ui/` — shared primitives: Button, Card, Input, Badge, Modal, PasswordStrengthMeter

### API Surface

| Route | Role | Action |
|-------|------|--------|
| `POST /api/auth/register` | public | Create customer account |
| `GET/POST /api/customers` | admin | List / search customers |
| `GET/PUT/DELETE /api/customers/[id]` | admin | Customer detail, password reset, delete |
| `POST /api/points/add` | admin | Credit points to a customer |
| `POST /api/points/redeem` | customer | Redeem a reward (deducts points, decrements stock) |
| `GET/POST /api/rewards` | admin | List / create rewards |
| `GET/PUT/DELETE /api/rewards/[id]` | admin | Reward detail, update, delete |

### Points Business Logic

- Earning: 10 points per hour of play, added by admin via `/api/points/add`
- Redeeming: customer triggers `/api/points/redeem`; server checks stock > 0 and sufficient balance before calling `add_points_transaction()` with a negative amount
