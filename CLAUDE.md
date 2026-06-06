# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server at localhost:3000
npm run build         # Production build
npm run start         # Start production server
npm run lint          # Run ESLint
npm test              # Vitest unit tests (268 tests, no DB required)
npm run test:e2e      # Playwright E2E tests (requires .env.e2e + running server)
npm run test:e2e:ui   # Playwright with interactive UI
npm run test:e2e:debug  # Playwright with step-by-step debugger
```

**First-time setup:**
1. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000` locally; `https://mya-thida-futsal.vercel.app` in Vercel env vars). Also add `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` for CMS image uploads.
2. Run these SQL files **in order** in the Supabase SQL editor:
   `supabase-setup.sql` → `supabase-fix-rls.sql` → `supabase-superadmin-migration.sql` → `redemption-requests-migration.sql` → `race-condition-fixes.sql` → `supabase-rls-security-fix.sql` → `soft-delete-rewards-migration.sql` → `handle-new-user-trigger-fix.sql` → `security-rls-rewards-fix.sql` → `security-rls-profiles-fix.sql` → `point-adjustment-migration.sql` → `booking-system-migration.sql` → `pending-override-migration.sql` → `cms-simplify-migration.sql` → `rls-bookings-fix.sql` → `rls-profiles-insert-fix.sql` → `rls-transactions-fix.sql` → `points-adjust-atomic-fix.sql` → **`confirm-override-atomic-migration.sql`** → `override-booking-date-fix.sql` → `closure-booking-conflict-trigger.sql` → `override-conflict-lock-fix.sql` → `booking-updated-at-migration.sql` → `trigger-else-branch-fix.sql` → `drop-shadow-redemption.sql` → `redemption-cost-snapshot-migration.sql` → `approve-use-snapshot-fix.sql` → `drop-booking-transaction-type.sql` → `points-delta-sign-constraint.sql` → `dead-schema-cleanup.sql` → `rls-rewards-write-fix.sql` → `rls-transactions-delete-fix.sql` → `rls-redemption-cancel-fix.sql`
3. Run `node --env-file=.env.local setup-admin.mjs` to seed the superadmin account and rewards. **`SUPERADMIN_PASSWORD` env var is required** — the script exits with an error if it is missing (no hardcoded fallback).

**Translations:** `GEMINI_API_KEY=... node scripts/translate.mjs` rewrites the Myanmar (`my`) exports in each `lib/i18n/namespaces/*.ts` file from the English source, preserving structure.

**E2E test setup:** Copy `.env.e2e.example` → `.env.e2e` and fill in real Supabase credentials plus test-account details. The Playwright config auto-starts the dev server; `globalSetup` seeds test data via the Supabase service-role key before the suite runs.

## Brand & Deployment

**Brand name:** MyaThida (public-facing). Internal email domains `@akoatp.com` (customers) and `@akoatp-staff.com` (staff) are auth identifiers only — never shown to users and must not be changed (existing Supabase accounts depend on them).

**Production URL:** `https://mya-thida-futsal.vercel.app` (Vercel project renamed from `futsal-point-system`). After any URL change, update Supabase → Authentication → URL Configuration (Site URL + Redirect URLs).

## Architecture

**Stack:** Next.js 16 App Router, TypeScript, Supabase (auth + DB), Tailwind CSS, Recharts (charts)

### Booking System (futsal court online booking)

Lives in the same codebase as the loyalty/points system. Single court, EN/MY, mobile-first (390px), deposit-confirmed bookings, Lucide icons, no emoji.

- **Design tokens:** `app/globals.css` holds the booking design tokens as CSS custom properties (`--color-primary` deep pitch-green, `--color-accent` gold, slot-state + price-tier colors, radii, shadows, fonts) plus `fb-*` / `pill-*` helper classes and a `.theme-wc` World Cup retheme block. `tailwind.config.ts` maps these to semantic Tailwind colors (`primary`, `accent`, `slot-*`, `holiday`, `price-*`, `ink`, `surface`, `line`) and fonts (`font-display` Sora, `font-body` Manrope, `font-fbmono` JetBrains Mono, `font-my` Noto Sans Myanmar). **The existing `brand-*` green scale and Tailwind defaults (`font-mono`, `rounded-*`) are untouched** — booking tokens are additive only. Fonts are loaded via `next/font/google` in `app/layout.tsx` (CSS vars on `<html>`).
- **Booking logic:** `lib/booking.ts` — pure, timezone-safe (ISO `YYYY-MM-DD`) helpers: `priceForHour`/`tierForHour` (weekday AM 20k / PM 25k / weekend+holiday 30k), `isThingyan` (Apr 13–16, fallback for years not in holidays config), `isWeekendRate` (checks `isWeekend || isThingyan || isHoliday`), `dayHours` (16 slots 06:00–21:00), `depositFor` (flat 10,000 MMK per booking — always `DEPOSIT_PER_SLOT` regardless of slot count), `canCancel(bookingDate, hourStart)` (12-hour refund window — **Myanmar-timezone-aware**: subtracts `MYANMAR_OFFSET_MS` same as `isSlotBookable`; enforced server-side in `PATCH /api/bookings/[id]` for customer cancels; admin bypass skips this check), `isSlotBookable(dateISO, hourStart)` (returns false when slot start is < `BOOKING_LEAD_HOURS=1` hour away — accounts for Myanmar UTC+6:30 offset; enforced server-side in `POST /api/bookings` for non-override bookings; `BookingView` uses this to mark past/imminent available slots as `'closed'`), `MAX_SLOTS=2`. Unit-tested in `__tests__/booking-logic.test.ts`.
- **Public holidays:** `lib/holidays.ts` — annual Myanmar public holiday list (currently 2026). Exports `isHoliday(isoDate)`, `getHolidayName(isoDate, lang)`, `getSlotTier(isoDate, hour)`. Update the `MYANMAR_HOLIDAYS` array each year with the new gazette. `isThingyan` in `booking.ts` acts as a fallback for Thingyan on years not yet in the config. The `book/page.tsx` `loadMonth` function uses `isHoliday`/`getHolidayName` to populate `calData.holidays`; `BookingView` calls `getHolidayName` to show the holiday name when a date is selected.
- **Multi-date cart:** `BookingView` holds `cart: CartSlot[]` (`{ date: string; hour: number; override?: boolean }`) in client state. Cart persists across calendar-date navigation — `selectDay` never clears it. `MAX_SLOTS=2` is enforced globally across all dates combined. Slots in the cart for the currently-viewed date show as selected in the grid; individual items can be removed via the × button in the summary sidebar. Total deposit = `uniqueCartDates.length × DEPOSIT_PER_SLOT` (one deposit per booking date, since each date becomes a separate DB booking). Proceed button encodes the cart as `?items=YYYY-MM-DD_H,...` (e.g. `?items=2026-05-28_7,2026-05-29_9`). Override slots (pending slot requests) are encoded separately as `?overrides=YYYY-MM-DD_H,...`. A date may contain either normal slots OR override slots — never both (enforced in `BookingView` cart logic). The confirm page (`book/confirm/page.tsx`) parses both params, attaches `overrideHours` to the relevant `BookingGroup`. `ConfirmFlow` groups items by date, calls `POST /api/bookings` sequentially (one per date group), and collects all booking refs for the success screen.
- **i18n:** booking strings live in `lib/i18n/namespaces/booking.ts` (`bookingEN`/`bookingMY`, keys prefixed `booking.`), registered in `lib/i18n/index.ts`. Uses the existing custom i18n (`useLanguage()` / `<T>`), **not** next-intl.
- **DB:** `booking-system-migration.sql` adds `bookings` (includes `updated_at TIMESTAMPTZ` column added by `booking-updated-at-migration.sql`, auto-updated on every write by `bookings_set_updated_at` trigger), `booking_slots` (with `active` mirror column + `uq_active_slot_per_hour` partial unique index as the race guard; kept in sync with parent booking status via the `sync_booking_slots_active` trigger — the trigger raises an exception for unrecognised status values after `trigger-else-branch-fix.sql`; `enforce_no_booking_on_closed_slot` trigger on INSERT checks `court_closures` and raises `slot_closed` if the date/slot is closed), `court_closures`, `cms_posts` (promotions = `category='promotion'`; `body_md`/`cover_url` columns exist but are no longer written — `manual_image_url` is the active cover image field, added by `cms-simplify-migration.sql`; `source_url` column is nullable and no longer surfaced in the editor UI). Adds `'booking'` to the `point_transactions.transaction_type` check. `create_booking_transaction()` RPC inserts a booking + its slots atomically and generates the `MYF-YYYY-NNNN` ref via `booking_ref_seq`. `bookings` is in the realtime publication. `pending-override-migration.sql` adds `override_request BOOLEAN NOT NULL DEFAULT FALSE` to `bookings` and creates `create_override_booking_transaction()` RPC — identical to `create_booking_transaction` but inserts slots with `active=false`, bypassing the `uq_active_slot_per_hour` partial unique index so an override booking can hold the same slot as an existing pending booking. `override-conflict-lock-fix.sql` supersedes this RPC to add `SELECT FOR UPDATE` locking — the check and INSERT are now atomic. When admin confirms an override booking, `PATCH /api/bookings/[id]` cancels conflicting pending bookings first (trigger sets their slots `active=false`), then confirms the override (trigger sets its slots `active=true`).
- **CMS image upload:** `CmsPostForm` uploads cover images via `POST /api/cms/upload-image` (server-side Cloudinary, `next-cloudinary` package). The returned `secure_url` is stored as `manual_image_url`. `NewsCardGrid` renders Cloudinary URLs via `<CldImage>` (automatic optimization + transformation) and non-Cloudinary URLs via Next.js `<Image unoptimized>`. Helper `isCloudinaryUrl(url)` distinguishes the two. `res.cloudinary.com` is in `next.config.js` `images.remotePatterns` and CSP `img-src`.
- **News post detail:** Clicking a card in `NewsCardGrid` (or `NewsCarousel` on the homepage) opens an in-app detail view — a bottom sheet on mobile (slide-up, drag-to-dismiss ≥80px, backdrop tap) and a centered modal on desktop (X button, backdrop tap). No external navigation on card click. EN/MY title/excerpt resolved same as on the card (`titleMy`/`excerptMy` when `lang === 'my'`, fallback to EN).
- **Admin component i18n:** `CmsPostList`, `CmsPostForm`, `AdminBookingsList`, and `ClosureManager` all use `useLanguage()` for translatable strings. All keys are in `lib/i18n/namespaces/booking.ts` under `booking.admin.*`.
- **Post-booking navigation on mobile:** The "View Bookings" button in `ConfirmFlow` step 3 uses `<a href="/account">` — **not** `router.push()`. Using `router.push("/bookings")` caused a two-hop RSC navigation: `/bookings` server component calls `redirect("/account")` immediately. On mobile browsers, session cookie propagation between the two RSC hops is unreliable — middleware sees no session on the second hop and redirects to `/login`. A plain `<a href>` does a single browser navigation with all cookies included. Do not change this to `router.push`.
- **Points integration:** booking confirmation no longer awards loyalty points automatically. Points are added only by admins via `/api/points/add` (manual session-play entry). The `bookings.points_awarded` column and `p_transaction_type='booking'` exist in the DB schema but are no longer written by the app — do not re-add automatic booking-triggered point logic.
- **Payment details (ConfirmFlow Step 2):** KBZ Pay — number `09 5190 865`, account name `Aung Thura Phyo`. Logo at `public/images/kbz-pay.webp` (copied from `figures/kbz-logo.webp`). Displayed in `components/booking/ConfirmFlow.tsx`.
- **Court image:** `public/images/court1.jpg` (copied from `figures/court1.jpg`) — used as the full-width hero banner in `BookingView`'s court card (`h-40 md:h-52`, `object-cover`, dark gradient overlay, court name overlaid white at bottom-left). Do not remove or rename this file.
- **Myanmar "Deposit" translation:** always use `စရံငွေ` — standardized across all `booking.*` i18n keys. Previous variants `စပေါ်ငွေ` / `အပေါင်ငွေ` are obsolete.
- **Viber contact link:** Always use native deep link `viber://chat?number=%2B959797272000`. Web-based alternatives (`connect.viber.com/...`, `viber.me/...`) have broken before — do NOT change this to a web URL.
- **Logos:** Auth pages, `SiteNavbar`, and `SiteFooter` use Next.js `<Image>` from `next/image`. Light backgrounds → `public/logo_black.jpg` (928×844). Dark backgrounds → `public/logo_white.jpg` (884×856). `components/booking/Logo.tsx` is an unused SVG mark — do not re-import it.

### Route Groups

- `app/(auth)/` — public login/register pages (customer + admin auth)
- `app/(customer)/` — customer-facing history page (protected, `customer` role); `/dashboard`, `/rewards`, `/bookings` in this group are stub redirects → `/account`
- `app/(admin)/` — admin dashboard, customer management, rewards, staff management (protected, `admin`/`superadmin` role)
- `app/api/` — REST API endpoints; all mutating endpoints verify session and role server-side

`middleware.ts` handles route protection and role-based redirects before any page renders.

### Unified Frontend (booking + loyalty)

This branch merges the booking system and loyalty/points system into one product. Three unification surfaces:

- **Unified customer account** — `app/(site)/account/page.tsx` (server, `force-dynamic`). Runs parallel queries: (1) all `point_transactions` selecting only `points_delta` for earned/redeemed stats, (2) upcoming pending/confirmed bookings (future dates only), (3) first 21 history bookings, (4) first 21 history txns — then renders `<SiteNavbar active="account" />` + `components/customer/account/UnifiedAccount.tsx`. The page passes `initialFeeds` (three pre-built 20-item FeedItem arrays — one per filter: `all`, `bookings`, `points`), `initialHasMore` flags, and `initialUpdatedAt` (profile `updated_at` for the realtime ordering guard). `UnifiedAccount` is a compact header (`AccountHeader` — avatar, name, member-since, flat points strip with lifetime earned/redeemed, no tiers) above three tabs — **Upcoming** (upcoming bookings, reuses `BookingHistoryCard` + Book CTA), **History** (`UnifiedTimeline` — booking events + point txns on one month-grouped rail, filterable all/bookings/points, with "Load more" button that calls `GET /api/account/history?filter=...&before=CURSOR`), **Points & Rewards** (flat balance + `RewardsGrid`). Points stay live via `useRealtimePoints` hook (channel `profile-points-${userId}` + 20s polling). Auth guard redirects to `/login?next=/account` if no session. Old routes `/dashboard`, `/rewards`, `/bookings` are stub redirect pages → `/account`. Feed builders live in `lib/account-feed.ts` (shared between the page and the API route).
- **No tiers** — `components/booking/PointsCard.tsx` is a flat gradient balance card (no earn-rate strip — that was removed when booking-auto-points was removed). The old Gold/Silver tier + progress bar was removed; do not reintroduce tier UI anywhere.
- **Bottom-sheet post-login booking flow** — on `/book`, a logged-out customer tapping "Log in to Book" opens `components/booking/BookingLoginSheet.tsx` (mobile bottom-sheet) instead of navigating; the cart stays in `BookingView` React state. On success the sheet closes, a welcome toast shows, and the CTA flips to "Confirm Booking" → existing `/book/confirm` flow. Sign-in reuses the same Supabase browser call as `LoginForm` (no new API). Desktop keeps the full-page `?next=/book/confirm?items=…` + `safeNext` fallback; `LoginForm` shows a "Booking held" banner when `next` targets `/book/confirm`.

### Loading Skeletons

Both route groups use Next.js `loading.tsx` files (co-located with each page) to show animated placeholder content during server-side data fetching.

**Pattern:** `animate-pulse` on each card; `bg-gray-200` for prominent elements, `bg-gray-100` for secondary; `rounded-2xl shadow-sm bg-white` for card blocks; `divide-y divide-gray-100` for list cards. No spinner — every skeleton mirrors the real page layout.

**Customer pages** (`app/(customer)/`) — `loading.tsx` adds `px-4 py-6` itself because the customer layout's `<main>` has no padding. Exception: `dashboard/loading.tsx` mirrors the unified-account layout (identity row + points strip + tabs + cards) and supplies its own padding to match `UnifiedAccount`.

**Admin pages** (`app/(admin)/`) — `loading.tsx` starts with `<div className="space-y-5">` only, because the admin content `<main>` (rendered by `AdminShell`) already applies `px-4 py-6 max-w-2xl mx-auto`. Skeleton colors use neutral grays (no green) to match the admin theme.

Admin pages with skeletons: `dashboard`, `customers`, `customers/[id]`, `redemptions`, `rewards`, `staff`, `staff/[id]`, `bookings`, `court`, `cms`, `profile`.

Form-only pages (`rewards/new`, `staff/new`) have no `loading.tsx` — they render immediately with no async DB fetch before display.

**Site (booking) pages** (`app/(site)/`) — the `SiteNavbar` is rendered inside each page component (not in the layout). Any `loading.tsx` in this route group **must** include `<SiteNavbar>` (and `<BottomNav>` where the real page has one) so the navbar stays visible during the loading state. Currently: `book/loading.tsx` includes `<SiteNavbar active="booking" back />`. `/bookings` redirects server-side to `/account`, so its `loading.tsx` never fires. `account/loading.tsx` includes `<SiteNavbar active="account" />` + `<BottomNav active="me" />` (matching the real page) and shows an account-shaped skeleton (avatar, points card, tab bar, content cards). Without this file the parent `(site)/loading.tsx` fires instead, which shows `active="home"` and the wrong nav highlight. Page content wrappers in `(site)` use the `.animate-page-in` CSS class (defined in `globals.css`) for a 150ms ease-out fade+slide entrance after loading resolves.

**Period-scoped skeleton pattern (superadmin dashboard):** The `loading.tsx` skeleton fires for full-page navigations but is too coarse for month/year filter changes — it would blank the entire dashboard. Instead, `DashboardPeriodSection` (a client component) wraps `router.replace()` in `useTransition`'s `startTransition`, which suppresses `loading.tsx` and exposes `isPending`. While `isPending=true`, only the period-scoped stat card numbers and chart areas show `animate-pulse` skeletons; the all-time Overview block and Recent Transactions remain visible. The period dropdowns are also `disabled={isPending}` to prevent double-navigation.

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

### Customer Password Reset Flow

Customer self-service forgot-password is removed. Customers cannot reset their own password via email — the Supabase auth identity uses a derived `{phone}@akoatp.com` address that cannot receive mail, making email-based reset fundamentally incompatible with phone-based login.

**Only path — Admin sets temp password:**
1. Admin opens customer row on the customers list → "Reset Password" button (KeyRound icon, label hidden on mobile).
2. `TempPasswordModal` auto-generates `MYF{last4digits}-{rand4}` temp password (e.g. `MYF2000-4821`). Copy + Regenerate buttons.
3. "Set This Password" → `POST /api/admin/reset-customer-password` (service role, IDOR guard — customer-only target, password never logged or stored by us).
4. Customer logs in with temp password → changes it in Account Settings → Change Password section.

**`auth/callback` error redirect:** always `/admin/reset-password?error=link_expired` (customer reset path no longer exists).

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
- `add_points_transaction()` is an RPC function that atomically increments `profiles.total_points` and inserts into `point_transactions`. Always call this via Supabase RPC — never do the two steps separately. Used for all three transaction types: `earn`, `redeem`, and `adjustment`. Pass `p_min_balance: 0` explicitly from app RPC calls so PostgREST resolves the intended overload unambiguously.
- `point_transactions.transaction_type` accepts `'earn'` (session play), `'redeem'` (reward redemption), or `'adjustment'` (manual correction by admin). The check constraint was updated by `point-adjustment-migration.sql`.
- `handle_new_user()` trigger auto-creates a `profiles` row when a new `auth.users` entry is inserted. Uses `COALESCE(raw_user_meta_data->>'username', split_part(email,'@',1))` so it doesn't crash when `raw_user_meta_data` is absent (e.g. users created via the Supabase Auth dashboard).
- `profiles.phone` is nullable — staff admin accounts have no phone.

**Tables:** `profiles`, `point_transactions`, `rewards`, `redemption_requests`

### Key Lib Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | `getCurrentUser()`, `requireRole()`, `requireAnyAdmin()`, `requireSuperAdmin()` — server-side auth helpers |
| `lib/schemas.ts` | Zod schemas + `badRequest()` / `parseJson()` / `serverError(detail?)` helpers used by every API route. `serverError` logs `detail` server-side and returns generic `{ error: 'An unexpected error occurred' }` (with `detail` also returned in non-production for debugging). Always use `serverError(error.message)` for 500 responses — never expose `error.message` directly to clients. |
| `lib/points.ts` | `calculatePoints()` — 10 points per hour |
| `lib/utils.ts` | `formatDate(dateStr, lang?)` — date-only display in Myanmar/Yangon timezone (e.g. `"24 May 2025"`; pass `lang='my'` for Myanmar script month names); `formatDateTime(dateStr, lang?)` — date + time with AM/PM in Myanmar timezone. Both use `timeZone: 'Asia/Yangon'` (UTC+6:30). Always use these helpers for any date/time display — never format raw timestamps without them. `toMyDigits(n: number): string` — converts ASCII digits to Myanmar digits (e.g. `7` → `၇`); used for Myanmar-locale date display. `MY_MONTHS` — record of English month name → Myanmar name (exported for direct lookup). `usernameToAdminEmail()` — maps staff username → `@akoatp-staff.com` email. `safeRedirect(next, fallback)` — validates `?next=` params before use; rejects absolute URLs, protocol-relative (`//`), backslash, and newline injection; returns `fallback` (default `'/'`) if invalid. Use in every place that redirects based on a user-supplied param. |
| `lib/supabase/client.ts` | Browser Supabase client (for client components) |
| `lib/supabase/server.ts` | SSR Supabase client + `createServiceClient()` (raw `@supabase/supabase-js`, truly bypasses RLS) |
| `lib/cached-queries.ts` | `getActiveRewards()` — `unstable_cache` wrapper (tag: `'rewards'`, revalidate: 30s) for the customer-facing rewards list. Filters `is_active=true` AND `is_deleted=false`. Any API route that mutates the `rewards` table **must** call `revalidateTag('rewards', 'default')` (Next.js 16 requires the cacheLife profile as second arg) or customers will see stale data for up to 30 s. |
| `lib/account-feed.ts` | `buildBookingFeedItem(row)` + `buildTxnFeedItem(row)` + `mergeFeed(bookingItems, txnItems)` — shared helpers used by both `app/(site)/account/page.tsx` and `app/api/account/history/route.ts` to build `FeedItem[]` from raw DB rows. `FeedTxnRow.reward` is typed as an array (Supabase join returns `{ name }[]`) and handled by the internal `rewardName()` helper. |
| `hooks/useRealtimePoints.ts` | `useRealtimePoints(userId, initialPoints, initialUpdatedAt?)` — shared hook; channel `profile-points-${userId}` + 20s polling; `initialUpdatedAt` seeds an ordering guard ref that discards buffered stale events. Used by `AccountHeader` (live balance in unified account) and `RealtimePointsBadge` (rewards + history pages). |
| `contexts/PendingRedemptionsContext.tsx` | `PendingRedemptionsProvider` + `usePendingRedemptions()` — single Supabase realtime channel (`'admin-pending-badge'`) + 15s polling fallback for all-time pending redemption count; mounted in `app/(admin)/layout.tsx` wrapping the entire admin UI; consumed by `AdminShell`'s sidebar (badge on the Requests item), `PendingSoundAlert` (sound), and `PendingRedemptionsBanner` (banner). |
| `contexts/PendingBookingsContext.tsx` | `PendingBookingsProvider` + `usePendingBookings()` — Supabase realtime channel (`'admin-pending-bookings-badge'`) + 15s polling fallback for pending booking count (`status='pending'`); mounted in `app/(admin)/layout.tsx` inside `PendingRedemptionsProvider`; initial count fetched via service-role client in the layout (bypasses `bookings` RLS); consumed by `AdminShell` sidebar (badge on the Bookings item). |
| `lib/notificationSound.ts` | `playNotificationBeep()` (high→low: 880 Hz then 660 Hz) for redemption alerts; `playBookingBeep()` (low→high: 660 Hz then 880 Hz) for new booking alerts — ascending tone distinguishes booking from redemption. Web Audio API; SSR-safe (`typeof window` guard); silently swallows `NotAllowedError` and all other errors. |
| `lib/holidays.ts` | Myanmar public holiday list + helpers: `isHoliday(isoDate)`, `getHolidayName(isoDate, lang)`, `getSlotTier(isoDate, hour)`. Update `MYANMAR_HOLIDAYS` array annually. Used by `lib/booking.ts` (`isWeekendRate`) and `app/(site)/book/page.tsx` (calendar markers). |

### Real-Time Architecture

Live UI updates use a two-tier pattern: Supabase Realtime `postgres_changes` subscription (instant when working) + 20s polling fallback (guaranteed).

**SQL prerequisites** — run once per table in Supabase SQL editor:
```sql
ALTER TABLE <table> REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE <table>;
```
Tables currently enabled: `redemption_requests`, `profiles`, `bookings` (enabled in `booking-system-migration.sql`).

**Column filter caveat:** `filter: id=eq.{uuid}` on `profiles` silently drops events. Subscribe unfiltered and check `payload.new.id === userId` client-side instead.

**`onResolved(id)` pattern:** instead of `router.refresh()` after approve/reject/cancel, components call a callback that removes the item from local state immediately — no full server re-render needed.

**Components with live subscriptions:**
| Component | Table | Events | Used in |
|-----------|-------|---------|---------|
| `PendingRedemptionsContext` | `redemption_requests` | INSERT, UPDATE | All admin pages (mounted in `app/(admin)/layout.tsx`) — powers AdminShell sidebar badge, PendingSoundAlert, PendingRedemptionsBanner |
| `PendingBookingsContext` | `bookings` | INSERT, UPDATE | All admin pages (mounted in `app/(admin)/layout.tsx`) — powers AdminShell sidebar badge on Bookings item + PendingBookingsSoundAlert |
| `AdminBookingsList` | `bookings` | INSERT, UPDATE | Admin bookings page — INSERT fetches full row by ID; if on page 1 and filter matches, prepends to list; otherwise sets `hasNewBookings` banner. UPDATE patches `status`/`deposit_received` in place. No 20s poll (replaced by server-side pagination). |
| `RedemptionsList` | `redemption_requests` | INSERT, UPDATE | Admin redemptions page |
| `PendingRequestsList` | `redemption_requests` | UPDATE (filtered by customer_id) | Customer history |
| `RewardsGrid` | `redemption_requests` | UPDATE (filtered by customer_id) | Customer rewards |
| `AccountHeader` (via `useRealtimePoints`) | `profiles` | UPDATE (unfiltered, client-side id check) | Customer account — live points balance |
| `RealtimePointsBadge` | `profiles` | UPDATE (unfiltered, client-side id check) | Customer rewards, history |

### Internationalization

`lib/i18n/` holds a client-side i18n layer (no Next.js routing involvement):
- Strings split into namespace files: `lib/i18n/namespaces/{auth,customer,common,admin}.ts`. Each exports `*EN` and `*MY` objects. `lib/i18n/index.ts` merges all into flat `en`/`my` maps and exports `TranslationKey`.
- `LanguageContext.tsx` exposes `useLanguage()` → `{ lang, setLang, t }`. Language persists to both `localStorage.lang` and a `lang` cookie (1-year, SameSite=Lax). `LanguageProvider` accepts an optional `initialLang` prop — pass the server-read cookie value from `app/layout.tsx` to eliminate flash-of-wrong-language on first render. `setLang` also updates `document.documentElement.lang` and `data-lang`. Falls back to English for missing keys; `t(key, vars)` does `{var}` substitution.
- Provider mounted globally in `components/Providers.tsx`.
- **Client components:** import `useLanguage` and call `t('key')` / `t('key', { var: value })`.
- **Server components:** use `<T k="key" />` or `<T k="key" vars={{ var: value }} />` — it's a `'use client'` leaf component in `components/ui/T.tsx`.
- `LanguageToggle` in `components/ui/LanguageToggle.tsx` accepts three variants: `variant="light"` (customer header + admin auth pages — on pitch-green background, `bg-white text-brand-700` active, `text-white/80` inactive); `variant="dark"` (legacy dark-gray backgrounds, `bg-white text-gray-900` active, `text-white/60` inactive); `variant="admin"` (admin topbar — on white/surface background, `bg-primary text-white` active, `text-ink-muted` inactive, `border-line` border). Use `variant="admin"` in `AdminShell`'s topbar; use `variant="light"` on admin auth pages (login, reset-password, forgot-password) since they now share the pitch-green background.
- When adding UI strings, add the key to **both** `*EN` and `*MY` in the relevant namespace file (or only `*EN` and regenerate via `scripts/translate.mjs`).

### Component Organization

- `components/auth/` — LoginForm, RegisterForm, AdminLoginForm, **AuthShell** (shared customer login/register chrome: full-bleed `linear-gradient(160deg, var(--color-primary), var(--color-primary-dark))`, football-pitch SVG watermark at `opacity 0.07`, 84×84 frosted-glass logo container with a 52×52 logo, white card using `var(--r-2xl)` + `var(--shadow-lg)`, `LanguageToggle variant="light"`. Customer `login`/`register`/`reset-password` pages render through it. Admin auth pages — login, reset-password, forgot-password — apply the same pitch-green background + watermark inline rather than via `AuthShell`, because they are client components or have different heading structure; use the same `var(--r-2xl)` card and `var(--shadow-lg)` shadow). **Auth submit buttons use `<Button>` (primary variant) which resolves to `bg-primary hover:bg-primary-dark` natively — no `!important` override needed.**
- `components/customer/` — RealtimePointsBadge, RewardsGrid, RewardCard, PendingRequestsList, **PendingRequestItem** (shows `requested_at` via `formatDateTime` — Myanmar TZ), **TransactionItem** (shows `created_at` via `formatDateTime` — Myanmar TZ; used on admin dashboard, admin customer detail page, and customer history page). `CustomerNav` exists as a file but is **not mounted** — it was removed from `app/(customer)/layout.tsx` when `/account` became the unified hub.
- `components/customer/account/` — unified account UI: **UnifiedAccount** (tab wrapper: **Upcoming · History · Points & Rewards** — tab key renamed from `'bookings'` to `'upcoming'`; default tab is `'upcoming'`; History tab has per-filter cursor pagination state — `feeds`, `hasMore`, `cursors` (next cursor per filter) keyed by `all|bookings|points`; "Load more" button calls `GET /api/account/history?filter=...&before=CURSOR` and appends results; switching filter resets to server-provided initial data for that filter), **AccountHeader** (identity + flat live points strip — earn rate pill removed; logout button uses `border-red-200 text-red-500` — ghost/outline style, always visibly red; no tiers; `Settings` gear icon links to `/account/settings`), **AccountSettingsForm** (client — 3 sections: Profile info (`PATCH /api/profile` for name/phone + optional recovery email via `supabase.auth.updateUser({ email })` — amber confirmation banner on first-time add; `@akoatp.com` derived emails stripped server-side and never pre-filled), Change Password (re-auth via `signInWithPassword` then `updateUser`), Danger Zone (contact-to-delete modal); inline auto-dismiss toast; uses site design tokens), **UnifiedTimeline** (merged booking + points feed, month-grouped, exports the serializable `FeedItem` type; receives items array from `UnifiedAccount` — no internal fetching)
- `components/admin/` — **PendingRedemptionsBanner** (reads pending count from `PendingRedemptionsContext`; no own subscription), **PendingSoundAlert** (render-nothing; plays descending beep via `playNotificationBeep` when redemption pending count increases — initial load skipped), **PendingBookingsSoundAlert** (render-nothing; plays ascending beep via `playBookingBeep` when booking pending count increases — initial load skipped; same pattern as PendingSoundAlert), **RedemptionsList** (accepts `initialRequests` + `initialHistory: RedemptionRequest[]`; shows pulsing-dot "Awaiting approval" section with pending cards at top, then history table of approved/rejected/cancelled below; real-time subscription + 20s poll keep pending list live), **RedemptionRequestCard** (amber card — customer avatar initials, reward icon, ref code `#XXXXXXXX` from first 8 chars of UUID, points cost, balance; Approve green / Decline red-outlined buttons with loading spinners), AddPointsForm, **AdjustPointsForm** (manual point corrections — positive or negative, mandatory reason field), **CustomerSearch** (searches by name OR phone via `?q=`; was phone-only `type="tel"` — now `type="text"`; search submitted on form submit), **CustomersTable** (client component — accepts `Profile[]` + optional `hoursMap: Map<string, number>`; renders real `<table>` on desktop (`hidden md:block`) with columns Customer/Phone/Points/Hours/Joined/Actions, and card list on mobile (`md:hidden`); 20/page pagination with `Showing X–Y of Z` counter; customers page fetches `.limit(200)` — flag if > 200 customers and add server-side pagination), **CustomerRow** (accepts `variant: 'table' | 'card'` — `table` renders a `<tr>` for the desktop table, `card` renders the mobile div; accepts optional `hoursPlayed?: number`; **exports `getAvatarColor(name)` and `getInitials(name)` helpers** used across all admin pages for consistent colored avatar initials — color derived from name char-code hash, 8 palette options), **EarningRuleCard** (client — displays `POINTS_PER_HOUR` pts/hr earning rate with an inline edit toggle; edit saves to local state only, no backend persistence — editing the actual rate requires changing `POINTS_PER_HOUR` in `lib/points.ts`), **CustomerDetailActions** (client — wraps `TempPasswordModal` + `DeleteCustomerButton` for the customer detail right column; manages modal open state), RewardForm, **RewardAdminRow** (redesigned: Zap icon + name/description/cost/stock; ToggleRight/ToggleLeft for active toggle, Pencil for edit, Trash2 for delete; rewards page splits into Active / Inactive sections), ResetPasswordForm, DeleteCustomerButton, CreateAdminForm, StaffResetPasswordForm, DeleteStaffButton, **AdminShell** (the admin layout shell — collapsible grouped sidebar `Dashboard · Booking{Bookings, Court} · Loyalty{Points & Rewards, Requests +badge, Customers} · Content{News, Staff — superadmin-only}` + mobile drawer + topbar; sidebar is `fixed inset-y-0 left-0 z-30` on desktop (`position: fixed`, `width: 68 | 248px`); main content has `marginLeft` matching sidebar width **on desktop only** (applied via `md:[margin-left:var(--sidebar-w)]` + CSS custom property — mobile gets zero margin so content takes full width); both animate with `transition duration-200`; mobile drawer is already `fixed inset-y-0`; reads `usePendingRedemptions()` for the amber `--color-accent` badge on the Requests item, `"99+"` when count > 99; also reads `usePendingBookings()` for the amber badge on the Bookings item (`bookingBadge: true` on that NAV entry); superadmin-only items hidden by role; replaced the old horizontal `AdminNav`; topbar shows `LanguageToggle variant="admin"` + `LogoutButton` only — username removed, sidebar footer already shows it; sidebar footer username/role block is a `<Link href="/admin/profile">` — clicking it navigates to the admin profile page; sets `document.title` to `"(!) Mya Thida Admin"` when total pending count > 0 and `"Mya Thida Admin"` otherwise — tab-title fallback for audio-blocked notifications), **AdminProfileForm** (client — Profile (display name via `PATCH /api/profile`) + Change Password sections; neutral admin gray styling; same toast pattern as customer settings), **LogoutButton** (outline button, red border `border-red-200`, `LogOut` icon from lucide-react, `hover:bg-red-50`)
- `components/booking/` — **NewsCarousel** (homepage news section — CSS scroll-snap horizontal carousel, 5 posts, `w-[85vw]` mobile / `w-72` desktop cards, nav dots that expand + fill `--color-primary` when active, prev/next arrows desktop-only; dots + arrows suppressed when `posts.length < 2`; `.scrollbar-hide` utility added to `globals.css`; same `NewsPostDetail` bottom-sheet/modal as `NewsCardGrid`; used in `HomeContent` — `NewsCardGrid` is still used on the `/news` page), **SiteNavbar** (top nav for `(site)` pages; desktop has Home · Book · News · **My Account** links (center nav) + `BookingLangToggle` + **User icon** with auth detection: shows first name + icon → `/account` when logged in, "Login" + icon → `/login` when not; mobile shows icon only, no text label (BottomNav covers My Account on mobile); auth state loaded via `supabase.auth.getUser()` in a client `useEffect`; `hydrating` state starts `true` and is cleared when `getUser()` resolves — label is hidden while hydrating to prevent "Login" flash on already-authenticated navigations), **BottomNav** (mobile-only 4-tab bar; "me" tab → `/account`), **BookingView** (client state: `cart: CartSlot[]`, `pendingSheetHour: number | null`; builds `?items=` + `?overrides=` URLs), **TimeSlotGrid** (accepts `overrideSelected?: number[]` + `onPendingClick?` props), **SlotTile** (accepts `selectedAsOverride?: boolean` — renders amber override styling; `onPendingClick` fires for pending slots), **PendingSlotSheet** (bottom sheet / modal; appears when user taps a pending slot; `hour` prop drives content; `onConfirm` adds override to cart), **ConfirmFlow** (reads `BookingGroup.overrideHours`, sends `override_request: true` for affected date groups, shows amber priority notice in step 1), **SlotLegend** (shows "tap to request" hint next to pending state), **AdminBookingsList** (server-side paginated — receives `initial`, `total`, `page`, `totalPages`, `pageSize`, `currentStatus/Search/From/To` props; URL-based navigation via `router.push()` for all filter/page changes; status tabs + debounced search input + date-range pickers + numbered pagination controls; real-time subscription patches INSERT/UPDATE in local state — INSERT prepends to page 1 if filter matches, shows "new bookings" banner on other pages; 20s poll removed)
- `components/admin/analytics/` — superadmin-only chart components (all `'use client'`): `DashboardPeriodSection` (client wrapper that owns `useTransition` for period navigation; renders period label/selector, 4 period stat cards with skeleton numbers, `PendingRedemptionsBanner`, and `ChartsSection` — prevents full-page `loading.tsx` on month/year change by wrapping `router.replace` in `startTransition`), `ChartsSection` (dynamic-imports charts with `ssr:false`, renders chart cards; takes `month`/`year` props to build the points-chart title; accepts `isPending` prop to replace chart areas with `ChartSkeleton` while a period transition is in progress), `PointsBarChart` (points issued vs redeemed, daily across the selected month), `StatusDonut` (redemption status breakdown for the selected month), `TopRewardsBar` (top 5 rewards by approvals in the selected month), `TopCustomersBar` (top 5 customers by points earned in the selected month), `PeriodSelector` (month + year dropdowns; accepts `onNavigate` callback prop so parent can wrap navigation in `startTransition`; accepts `disabled` prop to lock dropdowns during transition), `PeriodLabel` (renders the selected period as an uppercase "MONTH YEAR" heading). All use Recharts + `useLanguage()` for i18n.
- `components/ui/` — shared primitives: Button, Card, Input, **PasswordInput** (use for every password field — always has eye-toggle, add `showStrength` prop on new-password fields), Badge, Modal, **ConfirmModal** (reusable confirmation dialog — props: `isOpen`, `onClose`, `onConfirm`, `title`, `message`, `confirmLabel`, `cancelLabel`, `variant` (`danger`/`warning`/`default`), `isLoading`; use `danger` for permanent deletes, `warning` for reversible cancels/declines; replaces all `window.confirm()` and `window.alert()` — no native browser dialogs anywhere in the codebase), PasswordStrengthMeter (uses i18n; strength labels in `auth.strengthWeak/Fair/Good/Strong`), T (i18n leaf for server components), LanguageToggle

**Password fields:** Always use `<PasswordInput>` instead of `<Input type="password">`. The `showPasswordToggle` prop on `Input` is kept for backward compatibility but `PasswordInput` is the canonical pattern. Use `showStrength` on primary new-password fields only — never on confirm-password fields.

**Charts:** Recharts is installed for the superadmin analytics dashboard. `ssr:false` dynamic imports must live in a `'use client'` component (Next.js 16 forbids `ssr:false` in Server Components). Pass serializable data from the server page to the `ChartsSection` client wrapper, which handles all dynamic imports internally.

**Dashboard layout (both admin roles):** Both admin and superadmin dashboards now show: (1) `AwaitingApprovalSection` — pulsing amber dot + up to 5 pending redemption request cards with Review button linking to `/admin/redemptions`; hidden when count = 0. (2) `EarningRuleCard` — displays `POINTS_PER_HOUR` (10 pts/hr) with an inline edit toggle (local state only; no backend persistence — changing the actual rate requires editing `POINTS_PER_HOUR` in `lib/points.ts`). (3) 4 stat cards with Lucide icons — admin dashboard shows Total Members / Points Outstanding (sum of all customer `total_points`) / Pending Requests / Rewards Redeemed; superadmin shows Total Customers / Points Issued / Points Redeemed / Active Rewards. (4) Recent Activity (latest 10 transactions). Superadmin adds the full period-analytics section between stat cards and recent activity.

**Dashboard period filter:** The superadmin dashboard ([app/(admin)/admin/dashboard/page.tsx](app/(admin)/admin/dashboard/page.tsx)) is a server component that reads `searchParams` `?month=1–12&year=2023–current`. `month`/`year` are clamped to valid ranges and default to the current month/year on missing or invalid input. The server page passes all period-scoped data to `<DashboardPeriodSection>`, which owns navigation via `useTransition` (see Period-scoped skeleton pattern above). All queries are split into two groups:
- **All-time (NOT affected by the filter):** the Overview block — Total Customers, Points Issued, Points Redeemed, Active Rewards — plus the latest-10 Recent Transactions list. (The pending count for `PendingRedemptionsBanner` is now fetched once in `app/(admin)/layout.tsx` as `initialCount` for `PendingRedemptionsContext` — no longer a dashboard page query.)
- **Period-scoped (`[periodStart, periodEnd)` half-open range):** New Customers / Pts Issued, Approvals, Pending stat card, the daily points chart (one bar per day of the month), the status donut, Top Rewards (approvals), and Top Customers (**points earned in the month**, aggregated from `earn` transactions — not the all-time `total_points` balance). Period-scoped queries use different timestamp columns per table: `profiles` and `point_transactions` filter on `created_at`; `redemption_requests` filters on **`requested_at`** (that table has no `created_at` column — it uses `requested_at` as the submission timestamp and `resolved_at` as the resolution timestamp). Mixing up the column names causes queries to silently return null (Supabase PostgREST drops rows when the filter column doesn't exist), making charts show "no data."

**Customer detail page layout:** Two-column grid (`lg:grid-cols-[340px_1fr]`) — left column: profile card (large avatar initials, name, phone, 4xl points balance, hours-played / times-redeemed stats), AddPointsForm, AdjustPointsForm; right column: transaction history (max-h scroll), CustomerDetailActions (reset password modal + delete). Hours played computed server-side as sum of `earn` transactions / `POINTS_PER_HOUR`. Times redeemed fetched as count of approved `redemption_requests`.

**Staff/customer avatar initials:** `getAvatarColor(name)` and `getInitials(name)` are exported from `components/admin/CustomerRow.tsx` and reused across all admin pages (customers table, customer detail, staff list, staff detail, redemption cards). Color is a deterministic hash of the name string picking from 8 palette options — same name always gets the same color.

**Icons:** `lucide-react` is installed. Use Lucide components for all icons — import by name (e.g. `import { Gift, Clock } from 'lucide-react'`). Size with `className="w-4 h-4"` (inline/button) or `w-5 h-5` (nav), `w-10 h-10` (empty-state hero). Color via `text-*` utilities or inherit `currentColor` from the parent. Do not use inline SVGs for new icons.

### API Surface

| Route | Role | Action |
|-------|------|--------|
| `POST /api/auth/register` | public | Create customer account |
| `PATCH /api/profile` | any authenticated user | Update own profile — `username` + `phone` (Myanmar format); uses service role client (RLS on profiles is dropped); reuses `CustomerProfileUpdateSchema` |
| `GET/POST /api/customers` | admin/superadmin | List / search customers |
| `GET/PUT/DELETE /api/customers/[id]` | admin/superadmin | Customer detail, password reset, delete |
| `POST /api/points/add` | admin/superadmin | Credit points to a customer (session play) |
| `POST /api/points/adjust` | admin/superadmin | Manual point adjustment — positive or negative integer, mandatory `reason`, blocked if balance would go below zero |
| `GET/POST /api/redemptions` | customer (GET: admin) | List / create redemption requests |
| `PATCH /api/redemptions/[id]` | customer/admin | Cancel (customer) or approve/reject (admin) |
| `GET/POST /api/rewards` | superadmin (GET: any authenticated user) | List / create rewards |
| `GET /api/rewards/[id]` | any authenticated user | Reward detail; non-superadmin cannot see soft-deleted rewards |
| `PUT /api/rewards/[id]` (toggle only: `{ is_active }`) | admin/superadmin | Toggle active/inactive |
| `PUT /api/rewards/[id]` (full update) | superadmin | Update reward fields |
| `DELETE /api/rewards/[id]` | superadmin | Soft-delete reward (sets `is_deleted=true`, `is_active=false`) — row preserved so transaction history retains reward name |
| `POST /api/admin/reset-customer-password` | admin/superadmin | Set temp password for a customer — `{ userId, tempPassword }`, IDOR guard (customer-only), service role; never logs the password |
| `GET/POST /api/admin/staff` | superadmin | List / create staff admin accounts |
| `GET/PUT/DELETE /api/admin/staff/[id]` | superadmin | Staff detail, reset password, delete |
| `POST /api/bookings` | customer (login required) | Create booking — calls `create_booking_transaction` RPC (or `create_override_booking_transaction` when `override_request=true`); 409 on confirmed slot conflict; override bookings insert slots `active=false` to bypass unique index |
| `GET /api/account/history` | authenticated customer | Cursor-based history feed — params: `filter` (`all`\|`bookings`\|`points`), `before` (ISO timestamp cursor, omit for first page). Bookings cursor applies to `booking_date`; points cursor applies to `created_at`; `all` applies each to its own column. Returns `{ items: FeedItem[], hasMore: boolean, nextCursor: string \| null }`. |
| `PATCH /api/bookings/[id]` | customer/admin | cancel (customer, 12-hr window); confirm / unconfirm / close (admin — no points awarded on confirm); on confirm of `override_request` booking: auto-cancels conflicting `pending` bookings for the same date before confirming |
| `POST /api/closures` | admin/superadmin | Create court closure (day or single slot) |
| `DELETE /api/closures?id=` | admin/superadmin | Remove a court closure |
| `POST /api/cms` | superadmin | Create CMS post (news/promotion/league/event) — body: `slug`, `category`, `title`, `title_my`, `excerpt`, `excerpt_my`, `manual_image_url` (optional, Cloudinary URL set by upload zone), `published` |
| `PUT /api/cms/[id]` | superadmin | Update CMS post fields (preserves `published_at` on publish) |
| `DELETE /api/cms/[id]` | superadmin | Delete CMS post |
| `POST /api/cms/upload-image` | superadmin | Upload cover image to Cloudinary — multipart/form-data with `file` field (JPEG/PNG/WebP, max 5 MB); returns `{ url: string }` (Cloudinary `secure_url`); folder `myathida-futsal/cms`, width 800 limit, quality/format auto. `CLOUDINARY_API_SECRET` never leaves the server. |

**HTTP status code conventions:**
- 201: resource created (POST handlers)
- 400: invalid input or failed business precondition
- 401: no valid session
- 403: authenticated but wrong role
- 404: resource not found or wrong owner (ownership checks always return 404, not 403, to prevent enumeration)
- 409: valid request but resource state prevents the action (concurrent conflict, duplicate, state transition failure)
- 500: unexpected server error (generic message, no DB details)

**RPC exception → HTTP status mapping:**
| Exception             | Status | Description |
|-----------------------|--------|-------------|
| insufficient_balance  | 400    | Balance too low |
| insufficient_points   | 400    | Points too low |
| no_pending_conflict   | 400    | No pending booking to override |
| booking_not_found     | 404    | Override booking missing |
| request_not_found     | 404    | Redemption request missing |
| reward_unavailable    | 400    | Reward deleted/inactive at approval time |
| slot_closed           | 409    | Slot has a court closure |
| out_of_stock          | 409    | Reward stock depleted |
| not_pending           | 409    | Request already actioned |

### Points Business Logic

- Earning: 10 points per hour of play, added by admin via `/api/points/add`
- Redeeming: customer submits `POST /api/redemptions` (creates pending row with `points_cost_snapshot = reward.points_cost`); admin approves via `PATCH /api/redemptions/[id]` which calls `approve_redemption` RPC — deducts `points_cost_snapshot` (not live price), re-checks reward availability + stock, decrements stock atomically. The old `/api/points/redeem` shadow endpoint was removed (PTS-1).
- Adjusting: admin corrects mistakes via `/api/points/adjust`; positive or negative integer, mandatory `reason` stored as `note`; server blocks if `total_points + points_delta < 0`; creates `transaction_type='adjustment'` record for audit trail. Displayed in customer history with a Pencil icon on blue background, blue (positive) or red (negative) amount, and the reason as italic note.

### Security

**Applied fixes:**
- `profiles_update` RLS policy scoped to `is_admin()` only — customers cannot escalate their own role or inflate points via the anon key (`supabase-rls-security-fix.sql`)
- `transactions_insert` RLS policy scoped to `is_admin()` only — customers cannot self-insert point transactions (`supabase-rls-security-fix.sql`)
- `redemption_requests` unique partial index `(customer_id, reward_id) WHERE status = 'pending'` — prevents duplicate pending requests (race guard) (`supabase-rls-security-fix.sql`)
- `profiles_update` and `profiles_delete` RLS policies dropped entirely — no anon-key UPDATE/DELETE on profiles is needed (all mutations use service role); closes admin→superadmin escalation and admin-deletes-superadmin paths (`security-rls-profiles-fix.sql`)
- `rewards` SELECT RLS consolidated: duplicate/conflicting policies dropped, replaced with single policy requiring `auth.role() = 'authenticated'` — closes unauthenticated anon-key read of active rewards (`security-rls-rewards-fix.sql`)
- `rewards_insert`, `rewards_update`, `rewards_delete` RLS policies dropped — rewards mutations only go through service-role API routes; regular admins can no longer bypass the superadmin-only contract via anon key (`rls-rewards-write-fix.sql`)
- `transactions_delete` RLS policy dropped — ledger is now fully append-only from anon-key clients; all three write policies (insert/update/delete) are gone (`rls-transactions-delete-fix.sql`)
- `rr_customer_cancel` UPDATE policy tightened + `trg_cancel_columns_immutable` trigger added — customers can only flip `status` to `cancelled` on their own pending requests; all other columns are reset to their pre-update values for non-admin actors (`rls-redemption-cancel-fix.sql`)
- `POST /api/bookings` upgraded from `getCurrentUser()` to `requireRole('customer')` — admins/superadmins cannot create bookings via this endpoint (403)
- IDOR guards on all `[id]` API routes: `GET/PUT/DELETE /api/customers/[id]` verify target has `role='customer'`; `PUT /api/admin/staff/[id]` verifies target has `role='admin'` — prevents cross-role operations
- `PUT /api/rewards/[id]` calls `requireAnyAdmin()` before parsing the request body — auth guard fires before any body read
- `app/auth/callback/route.ts` validates the `next` param to reject absolute URLs, `//`, and `\` redirect bypasses
- `app/(auth)/admin/reset-password/page.tsx` calls `signOut({ scope: 'global' })` immediately after password update, not deferred
- `next.config.js` emits HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Content-Security-Policy` on every response; CSP includes explicit `frame-src` for Google Maps (`maps.google.com`, `maps.googleapis.com`) and Facebook embeds

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
