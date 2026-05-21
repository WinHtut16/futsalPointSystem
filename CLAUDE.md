# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server at localhost:3000
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
npm test              # Vitest unit tests (158 tests, no DB required)
npm run test:e2e      # Playwright E2E tests (requires .env.e2e + running server)
npm run test:e2e:ui   # Playwright with interactive UI
npm run test:e2e:debug  # Playwright with step-by-step debugger
```

**First-time setup:**
1. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
2. Run these SQL files **in order** in the Supabase SQL editor:
   `supabase-setup.sql` → `supabase-fix-rls.sql` → `supabase-superadmin-migration.sql` → `redemption-requests-migration.sql` → `race-condition-fixes.sql` → **`supabase-rls-security-fix.sql`**
3. Run `node --env-file=.env.local setup-admin.mjs` to seed the superadmin account and rewards

**Translations:** `GEMINI_API_KEY=... node scripts/translate.mjs` rewrites the Myanmar (`my`) export in `lib/i18n/translations.ts` from the English source, preserving structure.

**E2E test setup:** Copy `.env.e2e.example` → `.env.e2e` and fill in real Supabase credentials plus test-account details. The Playwright config auto-starts the dev server; `globalSetup` seeds test data via the Supabase service-role key before the suite runs.

## Architecture

**Stack:** Next.js 16 App Router, TypeScript, Supabase (auth + DB), Tailwind CSS

### Route Groups

- `app/(auth)/` — public login/register pages (customer + admin auth)
- `app/(customer)/` — customer-facing dashboard, history, rewards (protected, `customer` role)
- `app/(admin)/` — admin dashboard, customer management, rewards, staff management (protected, `admin`/`superadmin` role)
- `app/api/` — REST API endpoints; all mutating endpoints verify session and role server-side

`middleware.ts` handles route protection and role-based redirects before any page renders.

### Auth Flow

**Customers:** Supabase Auth with email derived from phone number (`{phone}@akoatp.com`). Registration goes through `/api/auth/register` which uses the service role client to bypass email confirmation.

**Staff admins:** Username-based login via internal email `{username}@akoatp-staff.com`. Accounts created by superadmin only via `/api/admin/staff`.

**Superadmin:** Real email (`winhtutcentury@gmail.com`), supports self-service forgot-password via Supabase email reset. Seeded via `setup-admin.mjs`.

Sessions are managed SSR-side via cookie-based tokens.

### Roles

Three roles stored in `profiles.role`: `customer`, `admin`, `superadmin`.

| Role | Capabilities |
|------|-------------|
| `customer` | View points/history, redeem rewards |
| `admin` | Add points, manage customers (incl. delete), view rewards |
| `superadmin` | All admin capabilities + rewards CRUD + staff admin CRUD + forgot-password via email |

Server-side guards in `lib/auth.ts`:
- `requireRole(role)` — exact role match
- `requireAnyAdmin()` — `admin` or `superadmin`
- `requireSuperAdmin()` — `superadmin` only

### Admin Forgot Password Flow

1. Superadmin visits `/admin/forgot-password` → enters real email
2. Supabase sends reset email with link to `/auth/callback?next=/admin/reset-password`
3. `/auth/callback/route.ts` exchanges PKCE code for session, redirects to `/admin/reset-password`
4. User sets new password → signs out → redirected to `/admin/login`

`ADMIN_PUBLIC_PATHS` bypasses the "must be logged in" guard; `ADMIN_AUTH_ONLY_PATHS` is a subset that also redirects already-logged-in users away. `/admin/reset-password` is in `PUBLIC` but NOT in `AUTH_ONLY` — user must be logged in to set a password.

### Database

All tables have Row-Level Security enforced. Key patterns:
- `is_admin()` is a `SECURITY DEFINER` function used in RLS policies to avoid infinite recursion when policies on `profiles` would otherwise re-query `profiles`. Returns true for both `admin` and `superadmin`.
- `add_points_transaction()` is an RPC function that atomically increments `profiles.total_points` and inserts into `point_transactions`. Always call this via Supabase RPC — never do the two steps separately.
- `handle_new_user()` trigger auto-creates a `profiles` row when a new `auth.users` entry is inserted.
- `profiles.phone` is nullable — staff admin accounts have no phone.

**Tables:** `profiles`, `point_transactions`, `rewards`, `redemption_requests`

### Key Lib Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | `getCurrentUser()`, `requireRole()`, `requireAnyAdmin()`, `requireSuperAdmin()` — server-side auth helpers |
| `lib/schemas.ts` | Zod schemas + `badRequest()` / `parseJson()` helpers used by every API route |
| `lib/points.ts` | `calculatePoints()` — 10 points per hour |
| `lib/utils.ts` | `usernameToAdminEmail()` — maps staff username → `@akoatp-staff.com` email |
| `lib/supabase/client.ts` | Browser Supabase client (for client components) |
| `lib/supabase/server.ts` | SSR Supabase client + `createServiceClient()` (raw `@supabase/supabase-js`, truly bypasses RLS) |

### Real-Time Architecture

Live UI updates use a two-tier pattern: Supabase Realtime `postgres_changes` subscription (instant when working) + 20s polling fallback (guaranteed).

**SQL prerequisites** — run once per table in Supabase SQL editor:
```sql
ALTER TABLE <table> REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE <table>;
```
Tables currently enabled: `redemption_requests`, `profiles`.

**Column filter caveat:** `filter: id=eq.{uuid}` on `profiles` silently drops events. Subscribe unfiltered and check `payload.new.id === userId` client-side instead.

**`onResolved(id)` pattern:** instead of `router.refresh()` after approve/reject/cancel, components call a callback that removes the item from local state immediately — no full server re-render needed.

**Components with live subscriptions:**
| Component | Table | Events | Used in |
|-----------|-------|---------|---------|
| `PendingRedemptionsBanner` | `redemption_requests` | INSERT, UPDATE | Admin dashboard |
| `RedemptionsList` | `redemption_requests` | INSERT, UPDATE | Admin redemptions page |
| `PendingRequestsList` | `redemption_requests` | UPDATE (filtered by customer_id) | Customer history |
| `RewardsGrid` | `redemption_requests` | UPDATE (filtered by customer_id) | Customer rewards |
| `PointsCard` | `profiles` | UPDATE (unfiltered, client-side id check) | Customer dashboard |

### Internationalization

`lib/i18n/` holds a client-side i18n layer (no Next.js routing involvement):
- `translations.ts` exports parallel `en` and `my` (Myanmar/Burmese) string maps with shared `TranslationKey` type.
- `LanguageContext.tsx` exposes `useLanguage()` → `{ lang, setLang, t }`. Language persists to `localStorage.lang`; falls back to English for missing keys; `t(key, vars)` does `{var}` substitution.
- Provider mounted globally in `components/Providers.tsx`.
- When adding UI strings, add the key to **both** `en` and `my` in `translations.ts` (or only `en` and regenerate via `scripts/translate.mjs`).

### Component Organization

- `components/auth/` — LoginForm, RegisterForm, AdminLoginForm
- `components/customer/` — PointsCard, RewardsGrid, RewardCard, PendingRequestsList, PendingRequestItem, TransactionItem, CustomerNav
- `components/admin/` — PendingRedemptionsBanner, RedemptionsList, RedemptionRequestCard, AddPointsForm, CustomerSearch, RewardForm, ResetPasswordForm, DeleteCustomerButton, CreateAdminForm, StaffResetPasswordForm, DeleteStaffButton, AdminNav, LogoutButton
- `components/ui/` — shared primitives: Button, Card, Input, Badge, Modal, PasswordStrengthMeter

### API Surface

| Route | Role | Action |
|-------|------|--------|
| `POST /api/auth/register` | public | Create customer account |
| `GET/POST /api/customers` | admin/superadmin | List / search customers |
| `GET/PUT/DELETE /api/customers/[id]` | admin/superadmin | Customer detail, password reset, delete |
| `POST /api/points/add` | admin/superadmin | Credit points to a customer |
| `GET/POST /api/redemptions` | customer (GET: admin) | List / create redemption requests |
| `PATCH /api/redemptions/[id]` | customer/admin | Cancel (customer) or approve/reject (admin) |
| `GET/POST /api/rewards` | superadmin (GET: any authenticated user) | List / create rewards |
| `GET/PUT/DELETE /api/rewards/[id]` | superadmin | Reward detail, update, delete |
| `GET/POST /api/admin/staff` | superadmin | List / create staff admin accounts |
| `GET/PUT/DELETE /api/admin/staff/[id]` | superadmin | Staff detail, reset password, delete |

### Points Business Logic

- Earning: 10 points per hour of play, added by admin via `/api/points/add`
- Redeeming: customer triggers `/api/points/redeem`; server checks stock > 0 and sufficient balance before calling `add_points_transaction()` with a negative amount

### Security

**Applied fixes** (see `supabase-rls-security-fix.sql` for the DB-side changes):
- `profiles_update` RLS policy scoped to `is_admin()` only — customers cannot escalate their own role or inflate points via the anon key
- `transactions_insert` RLS policy scoped to `is_admin()` only — customers cannot self-insert point transactions
- `redemption_requests` unique partial index `(customer_id, reward_id) WHERE status = 'pending'` — prevents duplicate pending requests (race guard)
- `app/auth/callback/route.ts` validates the `next` param to reject absolute URLs, `//`, and `\` redirect bypasses
- `app/(auth)/admin/reset-password/page.tsx` calls `signOut({ scope: 'global' })` immediately after password update, not deferred
- `next.config.js` emits HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy` on every response

**Known constraint:** `@supabase/ssr` does not set `httpOnly: true` on session cookies by design (browser client needs `document.cookie` access). Mitigated by the CSP header preventing inline script injection.

### Test Architecture

**Unit tests** (`__tests__/`, run with `npm test`, no DB required):
- `api-privilege-escalation.test.ts` — every protected route returns 401/403 for under-privileged callers; asserts no DB call is made when the guard fires
- `api-validation.test.ts` — every route returns 400 for malformed input; asserts no DB call is made when validation fires
- `business-logic.test.ts` — points/redemption logic with a controlled Supabase mock; covers concurrent race conditions

**E2E tests** (`e2e/`, run with `npm run test:e2e`, requires real Supabase + `.env.e2e`):
- `journey-1-customer.spec.ts` — register, view points, request and cancel a reward
- `journey-2-admin.spec.ts` — search customer, add points
- `journey-3-superadmin.spec.ts` — create staff admin, create reward, delete both
- `global-setup.ts` seeds deterministic test data; `global-teardown.ts` cleans it up
