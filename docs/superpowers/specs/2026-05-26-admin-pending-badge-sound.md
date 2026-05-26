# Spec: Admin Pending Requests Badge + Notification Sound

**Date:** 2026-05-26  
**Status:** Approved  
**Branch:** main

---

## Overview

Two features added to the admin panel:

1. **Badge on "Requests" nav tab** — shows live count of pending redemption requests; hides when zero.
2. **Notification sound** — plays a short beep whenever the pending count increases (new request arrives), on any admin page.

---

## Architecture

### Shared state: `PendingRedemptionsContext`

A single React context owns the realtime subscription and polling so all consuming components share one Supabase channel.

**File:** `contexts/PendingRedemptionsContext.tsx`

- `'use client'` component
- Props: `initialCount: number`
- Internal state: `count` (number)
- Supabase realtime channel name: `'admin-pending-badge'`
- Listens for:
  - `INSERT` on `redemption_requests` where `payload.new.status === 'pending'` → `setCount(c => c + 1)`
  - `UPDATE` on `redemption_requests` where `payload.old.status === 'pending'` AND `payload.new.status !== 'pending'` → `setCount(c => Math.max(0, c - 1))`
- Polling fallback: every **15 seconds**, fetches `count(*)` from `redemption_requests` where `status = 'pending'` using the browser Supabase client
- Cleanup: removes channel + clears interval on unmount
- Exports: `PendingRedemptionsProvider`, `usePendingRedemptions()` hook

### Admin layout change

**File:** `app/(admin)/layout.tsx`

- Already a server component that fetches `getCurrentUser()`
- Add one additional query: count pending redemptions via `createClient()` (SSR client)
- Pass `initialCount` to `<PendingRedemptionsProvider>`
- Wrap `<AdminNav>` and `<main>` children inside the provider
- Also mount `<PendingSoundAlert />` inside the provider (render-nothing component)

```tsx
// Rough shape — not actual code
const { count: initialPendingCount } = await supabase
  .from('redemption_requests')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'pending')

return (
  <PendingRedemptionsProvider initialCount={initialPendingCount ?? 0}>
    <AdminNav role={profile.role} />
    <PendingSoundAlert />
    <main>...</main>
  </PendingRedemptionsProvider>
)
```

---

## Feature 1: Nav Badge

### Badge UI

**File:** `components/admin/AdminNav.tsx`

- Already `'use client'`
- Call `usePendingRedemptions()` to get `count`
- The Requests link (`/admin/redemptions`) gets a badge:

```
[  Requests  🟡3  ]
```

- Badge is a `<span>` with `absolute -top-1 -right-2` positioning on the link container
- Link container needs `relative` and `inline-flex items-center gap-1` 
- Badge styles: `bg-amber-400 text-amber-900 text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full min-w-[18px] text-center`
- Hidden (`className="hidden"`) when `count === 0`
- Displays `"99+"` when `count > 99`, else `count.toString()`

### Nav link structure change

Currently each link renders `{link.label}` as plain text. For the Requests tab only, wrap in:

```tsx
<span className="relative inline-flex items-center">
  {link.label}
  {link.href === '/admin/redemptions' && count > 0 && (
    <span className="absolute -top-2 -right-4 bg-amber-400 text-amber-900 ...">
      {count > 99 ? '99+' : count}
    </span>
  )}
</span>
```

---

## Feature 2: Notification Sound

### Sound utility

**File:** `lib/notificationSound.ts`

- `playNotificationBeep(): Promise<void>`
- Creates `new AudioContext()` (or `window.AudioContext || window.webkitAudioContext`)
- Plays a two-tone beep:
  - Oscillator 1: 880 Hz, sine wave, gain ramp 0→0.3→0, duration ~200ms
  - Oscillator 2: 660 Hz, sine wave, gain ramp 0→0.2→0, starts 80ms after first, duration ~200ms
- Connects oscillators → gain nodes → `audioContext.destination`
- Wraps everything in `try/catch`; silently swallows `NotAllowedError` (autoplay block) and any other errors
- Does NOT show a toast or UI message — silent failure is acceptable per spec

### Sound trigger component

**File:** `components/admin/PendingSoundAlert.tsx`

- `'use client'`, render-nothing (`return null`)
- Calls `usePendingRedemptions()` to get `count`
- Uses `useRef<number>` to track previous count
- Uses `useRef<boolean>` for `isInitialLoad` flag (starts `true`)
- `useEffect` watching `count`:
  - On first run: set `prevCountRef.current = count`, set `isInitialLoad.current = false`, return (no sound)
  - On subsequent runs: if `count > prevCountRef.current` → call `playNotificationBeep()`; update `prevCountRef.current = count`

### Why render-nothing component (not inline in AdminNav)

Keeps sound logic separate from display logic. `AdminNav` renders links; `PendingSoundAlert` handles audio side effects. Single responsibility.

---

## `PendingRedemptionsBanner` refactor

**File:** `components/admin/PendingRedemptionsBanner.tsx`

- Replace internal `useState(initialCount)` + realtime + polling with `usePendingRedemptions()` from context
- Remove `initialCount` prop entirely (context owns initial value via layout)
- Net behavior: identical to today

**Prop-chain cleanup (3 files touched):**

| File | Change |
|---|---|
| `components/admin/analytics/DashboardPeriodSection.tsx` | Remove `pendingBannerCount` prop from interface + JSX |
| `app/(admin)/admin/dashboard/page.tsx` (superadmin block) | Remove `pendingCount` from `Promise.all`; remove `pendingBannerCount` from `<DashboardPeriodSection>` |
| `app/(admin)/admin/dashboard/page.tsx` (admin block) | Remove `pendingCount` from `Promise.all`; render `<PendingRedemptionsBanner />` with no props |

The layout query replaces the dashboard page queries for the banner's initial count.

---

## Data flow

```
layout.tsx (server)
  └─ fetch initialPendingCount
  └─ <PendingRedemptionsProvider initialCount={N}>
       ├─ <AdminNav>        → reads context → badge
       ├─ <PendingSoundAlert> → reads context → plays sound on increase
       └─ <main>
            └─ dashboard/page.tsx
                 └─ <PendingRedemptionsBanner> → reads context → banner display
```

---

## No new API endpoints

All count fetching goes directly through the browser Supabase client (same pattern as existing `PendingRedemptionsBanner`). No new `/api/` routes needed.

---

## i18n

No new translation keys required. Badge displays a number (language-agnostic). Sound has no text.

---

## Tests

No unit tests needed for this change:
- Context is a thin wrapper around Supabase client calls (already tested at the Supabase level)
- Sound utility is browser-API-only, untestable in jsdom without mocking AudioContext
- Badge rendering logic is trivial conditional

Existing tests unaffected:
- `PendingRedemptionsBanner` change is internal refactor (same public behavior)
- `AdminNav` change adds a display-only element; no role/auth logic changed

---

## Files changed summary

| File | Change |
|---|---|
| `contexts/PendingRedemptionsContext.tsx` | **NEW** — context + provider + hook |
| `lib/notificationSound.ts` | **NEW** — Web Audio beep utility |
| `components/admin/PendingSoundAlert.tsx` | **NEW** — render-nothing sound trigger |
| `app/(admin)/layout.tsx` | **MODIFY** — fetch count, wrap with provider, mount sound alert |
| `components/admin/AdminNav.tsx` | **MODIFY** — add badge via context |
| `components/admin/PendingRedemptionsBanner.tsx` | **MODIFY** — consume context, remove own subscription |
| `app/(admin)/admin/dashboard/page.tsx` | **MODIFY** — remove `initialCount` prop from banner |
