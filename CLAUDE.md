# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server at localhost:3000
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
npm test              # Vitest unit tests (200 tests, no DB required)
npm run test:e2e      # Playwright E2E tests (requires .env.e2e + running server)
npm run test:e2e:ui   # Playwright with interactive UI
npm run test:e2e:debug  # Playwright with step-by-step debugger
```

**First-time setup:**
1. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000` locally; `https://mya-thida-futsal.vercel.app` in Vercel env vars)
2. Run these SQL files **in order** in the Supabase SQL editor:
   `supabase-setup.sql` → `supabase-fix-rls.sql` → `supabase-superadmin-migration.sql` → `redemption-requests-migration.sql` → `race-condition-fixes.sql` → `supabase-rls-security-fix.sql` → `soft-delete-rewards-migration.sql` → `handle-new-user-trigger-fix.sql` → `security-rls-rewards-fix.sql` → `security-rls-profiles-fix.sql` → **`point-adjustment-migration.sql`**
3. Run `node --env-file=.env.local setup-admin.mjs` to seed the superadmin account and rewards

**Translations:** `GEMINI_API_KEY=... node scripts/translate.mjs` rewrites the Myanmar (`my`) exports in each `lib/i18n/namespaces/*.ts` file from the English source, preserving structure.

**E2E test setup:** Copy `.env.e2e.example` → `.env.e2e` and fill in real Supabase credentials plus test-account details. The Playwright config auto-starts the dev server; `globalSetup` seeds test data via the Supabase service-role key before the suite runs.

## Brand & Deployment

**Brand name:** MyaThida (public-facing). Internal email domains `@akoatp.com` (customers) and `@akoatp-staff.com` (staff) are auth identifiers only — never shown to users and must not be changed (existing Supabase accounts depend on them).

**Production URL:** `https://mya-thida-futsal.vercel.app` (Vercel project renamed from `futsal-point-system`). After any URL change, update Supabase → Authentication → URL Configuration (Site URL + Redirect URLs).

## Architecture

**Stack:** Next.js 16 App Router, TypeScript, Supabase (auth + DB), Tailwind CSS, Recharts (charts)

### Route Groups

- `app/(auth)/` — public login/register pages (customer + admin auth)
- `app/(customer)/` — customer-facing dashboard, history, rewards (protected, `customer` role)
- `app/(admin)/` — admin dashboard, customer management, rewards, staff management (protected, `admin`/`superadmin` role)
- `app/api/` — REST API endpoints; all mutating endpoints verify session and role server-side

`middleware.ts` handles route protection and role-based redirects before any page renders.

### Loading Skeletons

Both route groups use Next.js `loading.tsx` files (co-located with each page) to show animated placeholder content during server-side data fetching.

**Pattern:** `animate-pulse` on each card; `bg-gray-200` for prominent elements, `bg-gray-100` for secondary; `rounded-2xl shadow-sm bg-white` for card blocks; `divide-y divide-gray-100` for list cards. No spinner — every skeleton mirrors the real page layout.

**Customer pages** (`app/(customer)/`) — `loading.tsx` adds `px-4 py-6` itself because the customer layout's `<main>` has no padding.

**Admin pages** (`app/(admin)/`) — `loading.tsx` starts with `<div className="space-y-5">` only, because the admin layout's `<main>` already applies `px-4 py-6 max-w-2xl mx-auto`. Skeleton colors use neutral grays (no green) to match the admin theme.

Admin pages with skeletons: `dashboard`, `customers`, `customers/[id]`, `redemptions`, `rewards`, `staff`, `staff/[id]`.

Form-only pages (`rewards/new`, `staff/new`) have no `loading.tsx` — they render immediately with no async DB fetch before display.

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
| `admin` | Add points, adjust points (correction/audit), manage customers (incl. delete), view all rewards, toggle rewards active/inactive |
| `superadmin` | All admin capabilities + rewards CRUD + staff admin CRUD + forgot-password via email + full analytics dashboard |

Server-side guards in `lib/auth.ts`:
- `requireRole(role)` — exact role match
- `requireAnyAdmin()` — `admin` or `superadmin`
- `requireSuperAdmin()` — `superadmin` only

### Admin Forgot Password Flow

1. Superadmin visits `/admin/forgot-password` → enters real email
2. `forgot-password/page.tsx` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... })` using the browser client
3. Supabase sends a recovery email. **The email template must use `{{ .TokenHash }}`** (see Supabase dashboard note below) — this makes the link go directly to our callback with `?token_hash=XXX&type=recovery` instead of routing through Supabase's verify endpoint with a PKCE `?code=`. The token-hash approach requires no stored verifier and works on any device.
4. User clicks the link → browser goes directly to `https://[site]/auth/callback?token_hash=XXX&type=recovery&next=/admin/reset-password`
5. `/auth/callback/route.ts` calls `verifyOtp({ token_hash, type })` → Supabase validates → session cookies written directly onto the `NextResponse.redirect()` response (inline `createServerClient`, NOT `lib/supabase/server.ts` — see below) → redirect to `/admin/reset-password`
6. User sets new password → signs out globally → redirected to `/admin/login`

**If token exchange fails** (expired, already used, etc.): callback redirects to `/admin/reset-password?error=link_expired`. The reset-password page reads this via `window.location.search` in its `useEffect` and shows the error + "request new link" without requiring a session. This avoids the alternative path (`/admin/login`) which is `ADMIN_AUTH_ONLY` — middleware would silently redirect logged-in users to the dashboard and swallow the error.

**Supabase dashboard — required email template change:**
Authentication → Email Templates → Recovery. Replace `{{ .ConfirmationURL }}` with:
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/admin/reset-password
```
`{{ .SiteURL }}` resolves to the Site URL set in Authentication → URL Configuration (must be `https://myathida-futsal.vercel.app`).

**`/auth/callback` inline client note:** the callback creates a `createServerClient` inline (from `@supabase/ssr`, NOT `createClient()` from `lib/supabase/server.ts`). The inline client's `setAll` writes session cookies directly onto the `NextResponse.redirect()` response object. Using `lib/supabase/server.ts` here silently drops tokens — its `setAll` writes to `cookies()` from `next/headers`, which has no connection to the redirect response returned by the Route Handler.

`ADMIN_PUBLIC_PATHS` bypasses the "must be logged in" guard; `ADMIN_AUTH_ONLY_PATHS` is a subset that also redirects already-logged-in users away. `/admin/reset-password` is in `PUBLIC` but NOT in `AUTH_ONLY` — user must be logged in to set a password (but the error state is visible to anyone, logged-in or not).

### Database

All tables have Row-Level Security enforced. Key patterns:
- `is_admin()` is a `SECURITY DEFINER` function used in RLS policies to avoid infinite recursion when policies on `profiles` would otherwise re-query `profiles`. Returns true for both `admin` and `superadmin`.
- `add_points_transaction()` is an RPC function that atomically increments `profiles.total_points` and inserts into `point_transactions`. Always call this via Supabase RPC — never do the two steps separately. Used for all three transaction types: `earn`, `redeem`, and `adjustment`.
- `point_transactions.transaction_type` accepts `'earn'` (session play), `'redeem'` (reward redemption), or `'adjustment'` (manual correction by admin). The check constraint was updated by `point-adjustment-migration.sql`.
- `handle_new_user()` trigger auto-creates a `profiles` row when a new `auth.users` entry is inserted. Uses `COALESCE(raw_user_meta_data->>'username', split_part(email,'@',1))` so it doesn't crash when `raw_user_meta_data` is absent (e.g. users created via the Supabase Auth dashboard).
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
| `lib/cached-queries.ts` | `getActiveRewards()` — `unstable_cache` wrapper (tag: `'rewards'`, revalidate: 30s) for the customer-facing rewards list. Filters `is_active=true` AND `is_deleted=false`. Any API route that mutates the `rewards` table **must** call `revalidateTag('rewards', 'default')` (Next.js 16 requires the cacheLife profile as second arg) or customers will see stale data for up to 30 s. |
| `hooks/useRealtimePoints.ts` | `useRealtimePoints(userId, initialPoints)` — shared hook; same channel + 20s polling pattern as `PointsCard`. Used by `RealtimePointsBadge` on rewards and history pages. |

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
| `RealtimePointsBadge` | `profiles` | UPDATE (unfiltered, client-side id check) | Customer rewards, history |

### Internationalization

`lib/i18n/` holds a client-side i18n layer (no Next.js routing involvement):
- Strings split into namespace files: `lib/i18n/namespaces/{auth,customer,common,admin}.ts`. Each exports `*EN` and `*MY` objects. `lib/i18n/index.ts` merges all into flat `en`/`my` maps and exports `TranslationKey`.
- `LanguageContext.tsx` exposes `useLanguage()` → `{ lang, setLang, t }`. Language persists to `localStorage.lang`; falls back to English for missing keys; `t(key, vars)` does `{var}` substitution.
- Provider mounted globally in `components/Providers.tsx`.
- **Client components:** import `useLanguage` and call `t('key')` / `t('key', { var: value })`.
- **Server components:** use `<T k="key" />` or `<T k="key" vars={{ var: value }} />` — it's a `'use client'` leaf component in `components/ui/T.tsx`.
- `LanguageToggle` in `components/ui/LanguageToggle.tsx` accepts `variant="light"` (customer header, green active bg) or `variant="dark"` (admin auth pages — login and reset-password — placed `absolute top-4 right-4`, white active bg on dark background). Do NOT use `variant="light"` styling on admin pages — the dark variant uses `bg-white text-gray-900` for active, `text-white/60` for inactive; the light variant uses `bg-white text-brand-700` / `text-white/80`.
- When adding UI strings, add the key to **both** `*EN` and `*MY` in the relevant namespace file (or only `*EN` and regenerate via `scripts/translate.mjs`).

### Component Organization

- `components/auth/` — LoginForm, RegisterForm, AdminLoginForm
- `components/customer/` — PointsCard, RealtimePointsBadge, RewardsGrid, RewardCard, PendingRequestsList, PendingRequestItem, TransactionItem, CustomerNav
- `components/admin/` — PendingRedemptionsBanner, RedemptionsList, RedemptionRequestCard, AddPointsForm, **AdjustPointsForm** (manual point corrections — positive or negative, mandatory reason field), CustomerSearch, RewardForm, RewardAdminRow, ResetPasswordForm, DeleteCustomerButton, CreateAdminForm, StaffResetPasswordForm, DeleteStaffButton, AdminNav, LogoutButton
- `components/admin/analytics/` — superadmin-only chart components (all `'use client'`): `ChartsSection` (dynamic-imports charts with `ssr:false`, renders chart cards), `PointsBarChart` (points issued vs redeemed last 30 days), `StatusDonut` (redemption status breakdown), `TopRewardsBar` (top 5 rewards by approvals), `TopCustomersBar` (top 5 customers by points). All use Recharts + `useLanguage()` for i18n.
- `components/ui/` — shared primitives: Button, Card, Input, **PasswordInput** (use for every password field — always has eye-toggle, add `showStrength` prop on new-password fields), Badge, Modal, PasswordStrengthMeter (uses i18n; strength labels in `auth.strengthWeak/Fair/Good/Strong`), T (i18n leaf for server components), LanguageToggle

**Password fields:** Always use `<PasswordInput>` instead of `<Input type="password">`. The `showPasswordToggle` prop on `Input` is kept for backward compatibility but `PasswordInput` is the canonical pattern. Use `showStrength` on primary new-password fields only — never on confirm-password fields.

**Charts:** Recharts is installed for the superadmin analytics dashboard. `ssr:false` dynamic imports must live in a `'use client'` component (Next.js 16 forbids `ssr:false` in Server Components). Pass serializable data from the server page to the `ChartsSection` client wrapper, which handles all dynamic imports internally.

**Icons:** No external icon library is installed. All icons are inline SVGs using `fill="none" stroke="currentColor" viewBox="0 0 24 24"` with `strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}`. Do not add an icon library; write inline SVGs instead.

### API Surface

| Route | Role | Action |
|-------|------|--------|
| `POST /api/auth/register` | public | Create customer account |
| `GET/POST /api/customers` | admin/superadmin | List / search customers |
| `GET/PUT/DELETE /api/customers/[id]` | admin/superadmin | Customer detail, password reset, delete |
| `POST /api/points/add` | admin/superadmin | Credit points to a customer (session play) |
| `POST /api/points/adjust` | admin/superadmin | Manual point adjustment — positive or negative integer, mandatory `reason`, blocked if balance would go below zero |
| `GET/POST /api/redemptions` | customer (GET: admin) | List / create redemption requests |
| `PATCH /api/redemptions/[id]` | customer/admin | Cancel (customer) or approve/reject (admin) |
| `GET/POST /api/rewards` | superadmin (GET: any authenticated user) | List / create rewards |
| `GET /api/rewards/[id]` | any authenticated user | Reward detail |
| `PUT /api/rewards/[id]` (toggle only: `{ is_active }`) | admin/superadmin | Toggle active/inactive |
| `PUT /api/rewards/[id]` (full update) | superadmin | Update reward fields |
| `DELETE /api/rewards/[id]` | superadmin | Soft-delete reward (sets `is_deleted=true`, `is_active=false`) — row preserved so transaction history retains reward name |
| `GET/POST /api/admin/staff` | superadmin | List / create staff admin accounts |
| `GET/PUT/DELETE /api/admin/staff/[id]` | superadmin | Staff detail, reset password, delete |

### Points Business Logic

- Earning: 10 points per hour of play, added by admin via `/api/points/add`
- Redeeming: customer triggers `/api/points/redeem`; server checks stock > 0 and sufficient balance before calling `add_points_transaction()` with a negative amount
- Adjusting: admin corrects mistakes via `/api/points/adjust`; positive or negative integer, mandatory `reason` stored as `note`; server blocks if `total_points + points_delta < 0`; creates `transaction_type='adjustment'` record for audit trail. Displayed in customer history as ✏️ with blue (positive) or red (negative) amount and the reason as italic note.

### Security

**Applied fixes:**
- `profiles_update` RLS policy scoped to `is_admin()` only — customers cannot escalate their own role or inflate points via the anon key (`supabase-rls-security-fix.sql`)
- `transactions_insert` RLS policy scoped to `is_admin()` only — customers cannot self-insert point transactions (`supabase-rls-security-fix.sql`)
- `redemption_requests` unique partial index `(customer_id, reward_id) WHERE status = 'pending'` — prevents duplicate pending requests (race guard) (`supabase-rls-security-fix.sql`)
- `profiles_update` and `profiles_delete` RLS policies dropped entirely — no anon-key UPDATE/DELETE on profiles is needed (all mutations use service role); closes admin→superadmin escalation and admin-deletes-superadmin paths (`security-rls-profiles-fix.sql`)
- `rewards` SELECT RLS consolidated: duplicate/conflicting policies dropped, replaced with single policy requiring `auth.role() = 'authenticated'` — closes unauthenticated anon-key read of active rewards (`security-rls-rewards-fix.sql`)
- IDOR guards on all `[id]` API routes: `GET/PUT/DELETE /api/customers/[id]` verify target has `role='customer'`; `PUT /api/admin/staff/[id]` verifies target has `role='admin'` — prevents cross-role operations
- `PUT /api/rewards/[id]` calls `requireAnyAdmin()` before parsing the request body — auth guard fires before any body read
- `app/auth/callback/route.ts` validates the `next` param to reject absolute URLs, `//`, and `\` redirect bypasses
- `app/(auth)/admin/reset-password/page.tsx` calls `signOut({ scope: 'global' })` immediately after password update, not deferred
- `next.config.js` emits HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy` on every response

**Known constraint:** `@supabase/ssr` does not set `httpOnly: true` on session cookies by design (browser client needs `document.cookie` access). Mitigated by the CSP header preventing inline script injection.

### Test Architecture

**Unit tests** (`__tests__/`, run with `npm test`, no DB required):
- `api-privilege-escalation.test.ts` — every protected route returns 401/403 for under-privileged callers; asserts no DB call is made when the guard fires
- `api-validation.test.ts` — every route returns 400 for malformed input; asserts no DB call is made when validation fires
- `business-logic.test.ts` — points/redemption logic with a controlled Supabase mock; covers concurrent race conditions, `calculatePoints`, points/add success path, redemption reject branch, and soft-deleted reward handling
- `middleware.test.ts` — route-guard redirect logic for all role combinations (unauthenticated, customer, admin, superadmin)
- `rewards-visibility.test.ts` — GET /api/rewards applies `is_active=true` filter for customers but not admins; PUT toggle-only vs full-update authorization
- `api-idor.test.ts` — IDOR guards on `[id]` routes: customers/[id] returns 404 for non-customer targets; staff/[id] returns 404 for non-admin targets; sensitive auth ops (updateUserById, deleteUser) not called when guard fires

**E2E tests** (`e2e/`, run with `npm run test:e2e`, requires real Supabase + `.env.e2e`):
- `journey-1-customer.spec.ts` — register, view points, request and cancel a reward
- `journey-2-admin.spec.ts` — search customer, add points
- `journey-3-superadmin.spec.ts` — create staff admin, create reward, delete both
- `journey-4-auth.spec.ts` — login redirects for customer and admin; unauthenticated access to protected routes
- `journey-5-negative.spec.ts` — insufficient balance blocks redemption; admin reject leaves customer points unchanged
- `global-setup.ts` seeds deterministic test data (fixed UUIDs + cache revalidation via `/api/test/revalidate-rewards`); `global-teardown.ts` cleans it up

**Cache revalidation endpoint:** `app/api/test/revalidate-rewards/route.ts` — POST endpoint (dev/test only, returns 403 in production) that calls `revalidateTag('rewards')` so E2E test setup can bust the `unstable_cache` immediately after seeding reward data.
