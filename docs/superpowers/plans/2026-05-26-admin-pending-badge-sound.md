# Admin Pending Requests Badge + Notification Sound — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live pending-count badge to the admin "Requests" nav tab and a Web Audio notification beep when new requests arrive.

**Architecture:** A single `PendingRedemptionsContext` (Supabase realtime + 15 s polling) is mounted in the admin layout and shared by all consumers — `AdminNav` (badge), `PendingRedemptionsBanner` (banner), and `PendingSoundAlert` (render-nothing beep trigger). This replaces the per-component subscription that `PendingRedemptionsBanner` previously owned.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase client (`@supabase/ssr`), Web Audio API, Tailwind CSS, React context.

---

## File Map

| Status | File | Role |
|---|---|---|
| CREATE | `contexts/PendingRedemptionsContext.tsx` | Context + provider + `usePendingRedemptions` hook |
| CREATE | `lib/notificationSound.ts` | Web Audio beep utility |
| CREATE | `components/admin/PendingSoundAlert.tsx` | Render-nothing sound trigger component |
| MODIFY | `app/(admin)/layout.tsx` | Fetch initial count; wrap with provider + mount sound alert |
| MODIFY | `components/admin/PendingRedemptionsBanner.tsx` | Swap own subscription for context; remove `initialCount` prop |
| MODIFY | `components/admin/analytics/DashboardPeriodSection.tsx` | Remove `pendingBannerCount` prop; update banner call |
| MODIFY | `app/(admin)/admin/dashboard/page.tsx` | Remove now-redundant `pendingCount` queries + props (two blocks) |
| MODIFY | `components/admin/AdminNav.tsx` | Read context; render amber badge on "Requests" tab |

---

## Task 1: Create `PendingRedemptionsContext`

**Files:**
- Create: `contexts/PendingRedemptionsContext.tsx`

- [ ] **Step 1.1: Create the context file**

```tsx
// contexts/PendingRedemptionsContext.tsx
'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'

interface PendingRedemptionsContextValue {
  count: number
}

const PendingRedemptionsContext = createContext<PendingRedemptionsContextValue>({ count: 0 })

const POLL_INTERVAL_MS = 15_000

export function PendingRedemptionsProvider({
  initialCount,
  children,
}: {
  initialCount: number
  children: ReactNode
}) {
  const [count, setCount] = useState(initialCount)

  const fetchCount = useCallback(async () => {
    const supabase = createClient()
    const { count: fresh } = await supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (fresh !== null) setCount(fresh)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('admin-pending-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'redemption_requests' },
        (payload) => {
          if ((payload.new as { status: string }).status === 'pending') {
            setCount((c) => c + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'redemption_requests' },
        (payload) => {
          const prev = (payload.old as { status?: string }).status
          const next = (payload.new as { status: string }).status
          if (prev === 'pending' && next !== 'pending') {
            setCount((c) => Math.max(0, c - 1))
          }
        }
      )
      .subscribe()

    const timer = setInterval(fetchCount, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchCount])

  return (
    <PendingRedemptionsContext.Provider value={{ count }}>
      {children}
    </PendingRedemptionsContext.Provider>
  )
}

export function usePendingRedemptions(): PendingRedemptionsContextValue {
  return useContext(PendingRedemptionsContext)
}
```

- [ ] **Step 1.2: Run existing tests — verify nothing breaks**

```
npm test
```

Expected: 204 tests pass (this file has no test; just confirming no regressions).

- [ ] **Step 1.3: Commit**

```
git add contexts/PendingRedemptionsContext.tsx
git commit -m "feat: add PendingRedemptionsContext with realtime + 15s polling"
```

---

## Task 2: Create notification sound utility

**Files:**
- Create: `lib/notificationSound.ts`

- [ ] **Step 2.1: Create the utility**

```ts
// lib/notificationSound.ts

/**
 * Plays a short two-tone beep via the Web Audio API.
 * Silently swallows NotAllowedError (browser autoplay block) and any other errors.
 */
export async function playNotificationBeep(): Promise<void> {
  try {
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()

    const playTone = (
      frequency: number,
      startTime: number,
      duration: number,
      peakGain: number
    ) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, startTime)

      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.05)
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration)

      oscillator.start(startTime)
      oscillator.stop(startTime + duration)
    }

    const now = ctx.currentTime
    playTone(880, now, 0.2, 0.3)        // high tone
    playTone(660, now + 0.08, 0.2, 0.2) // lower tone, slight delay

    // Release AudioContext after sounds finish
    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch {
    // Silently swallow NotAllowedError (autoplay block) and any other errors
  }
}
```

- [ ] **Step 2.2: Run tests**

```
npm test
```

Expected: 204 tests pass.

- [ ] **Step 2.3: Commit**

```
git add lib/notificationSound.ts
git commit -m "feat: add Web Audio notification beep utility"
```

---

## Task 3: Create `PendingSoundAlert` component

**Files:**
- Create: `components/admin/PendingSoundAlert.tsx`

- [ ] **Step 3.1: Create the component**

```tsx
// components/admin/PendingSoundAlert.tsx
'use client'

import { useEffect, useRef } from 'react'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'
import { playNotificationBeep } from '@/lib/notificationSound'

/**
 * Render-nothing component. Plays a beep when pending request count increases.
 * Must be rendered inside <PendingRedemptionsProvider>.
 */
export default function PendingSoundAlert() {
  const { count } = usePendingRedemptions()
  const prevCountRef = useRef<number | null>(null)

  useEffect(() => {
    // First render: record baseline count without playing sound
    if (prevCountRef.current === null) {
      prevCountRef.current = count
      return
    }

    // Subsequent renders: play sound only when count increases
    if (count > prevCountRef.current) {
      playNotificationBeep()
    }

    prevCountRef.current = count
  }, [count])

  return null
}
```

- [ ] **Step 3.2: Run tests**

```
npm test
```

Expected: 204 tests pass.

- [ ] **Step 3.3: Commit**

```
git add components/admin/PendingSoundAlert.tsx
git commit -m "feat: add PendingSoundAlert render-nothing component"
```

---

## Task 4: Update admin layout — wrap with provider + mount sound alert

**Files:**
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 4.1: Replace the entire file content**

```tsx
// app/(admin)/layout.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'
import LogoutButton from '@/components/admin/LogoutButton'
import LanguageToggle from '@/components/ui/LanguageToggle'
import { PendingRedemptionsProvider } from '@/contexts/PendingRedemptionsContext'
import PendingSoundAlert from '@/components/admin/PendingSoundAlert'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUser()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
    redirect('/admin/login')
  }

  const supabase = await createClient()
  const { count: initialPendingCount } = await supabase
    .from('redemption_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <PendingRedemptionsProvider initialCount={initialPendingCount ?? 0}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_black.jpg" alt="Mya Thida" className="h-10 w-10 rounded-lg object-contain" />
            <span className="font-bold text-base leading-tight">
              Mya Thida
              <br />
              <span className="text-gray-400 text-xs font-normal">Admin Panel</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle variant="dark" />
            <div className="text-right">
              <p className="text-sm text-gray-200">{profile.username}</p>
              <p className="text-xs text-gray-400 capitalize">{profile.role}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <AdminNav role={profile.role} />
        <PendingSoundAlert />
        <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full">{children}</main>
      </div>
    </PendingRedemptionsProvider>
  )
}
```

- [ ] **Step 4.2: Run tests**

```
npm test
```

Expected: 204 tests pass.

- [ ] **Step 4.3: Commit**

```
git add app/\(admin\)/layout.tsx
git commit -m "feat: wrap admin layout with PendingRedemptionsProvider + PendingSoundAlert"
```

---

## Task 5: Refactor `PendingRedemptionsBanner` to use context

**Files:**
- Modify: `components/admin/PendingRedemptionsBanner.tsx`

> **Note:** After this step `PendingRedemptionsBanner` no longer accepts `initialCount`. Tasks 6 and 7 fix the callers. TypeScript errors are expected until Task 7 is complete.

- [ ] **Step 5.1: Replace the entire file content**

```tsx
// components/admin/PendingRedemptionsBanner.tsx
'use client'

import Link from 'next/link'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function PendingRedemptionsBanner() {
  const { count } = usePendingRedemptions()
  const { t } = useLanguage()

  if (count === 0) return null

  return (
    <Link href="/admin/redemptions">
      <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
        <div>
          <p className="font-semibold text-yellow-800 text-sm">{t('admin.pendingRedemptions')}</p>
          <p className="text-xs text-yellow-600">{t('admin.tapToReview')}</p>
        </div>
        <span className="bg-yellow-400 text-yellow-900 font-bold text-sm px-2.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 5.2: Commit**

```
git add components/admin/PendingRedemptionsBanner.tsx
git commit -m "refactor: PendingRedemptionsBanner reads from context, removes own subscription"
```

---

## Task 6: Remove `pendingBannerCount` from `DashboardPeriodSection`

**Files:**
- Modify: `components/admin/analytics/DashboardPeriodSection.tsx`

- [ ] **Step 6.1: Remove `pendingBannerCount` from the interface (line 28)**

Find and remove this line from the `DashboardPeriodSectionProps` interface:
```ts
  // All-time pending count for the banner (not period-scoped)
  pendingBannerCount: number
```

- [ ] **Step 6.2: Remove `pendingBannerCount` from the destructured props (line 72)**

Find and remove `pendingBannerCount,` from the function's destructuring block:
```ts
  pendingThisMonth,
  pendingBannerCount,   // ← remove this line
  chartData,
```

- [ ] **Step 6.3: Remove `initialCount` prop from the banner call (line 129)**

Change:
```tsx
      <PendingRedemptionsBanner initialCount={pendingBannerCount} />
```
To:
```tsx
      <PendingRedemptionsBanner />
```

- [ ] **Step 6.4: Run tests**

```
npm test
```

Expected: 204 tests pass (one TypeScript error remains in `dashboard/page.tsx` — fixed in Task 7).

- [ ] **Step 6.5: Commit**

```
git add components/admin/analytics/DashboardPeriodSection.tsx
git commit -m "refactor: remove pendingBannerCount prop from DashboardPeriodSection"
```

---

## Task 7: Remove redundant `pendingCount` queries from dashboard page

**Files:**
- Modify: `app/(admin)/admin/dashboard/page.tsx`

There are two independent blocks in this file: the **superadmin block** (lines ~61–285) and the **admin block** (lines ~288–end). Each block has its own `Promise.all` that fetches `pendingCount` for the now-context-driven banner. Both queries are removed.

### 7A — Superadmin block

- [ ] **Step 7A.1: Remove `{ count: pendingCount }` from the destructure**

Find the superadmin `Promise.all` destructuring (around line 62). Remove the line:
```ts
      { count: pendingCount },
```

The surrounding context looks like this — remove only the marked line:
```ts
      { count: approvedThisMonth },
      { count: pendingCount },        // ← REMOVE
      { count: pendingThisMonth },
```

- [ ] **Step 7A.2: Remove the corresponding query from the `Promise.all` array**

Find and remove this block from the array (around lines 124–129):
```ts
      // — Banner: current actionable pending (all-time) —
      supabase
        .from('redemption_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
```

- [ ] **Step 7A.3: Remove `pendingBannerCount` prop from `<DashboardPeriodSection>`**

Find (around line 260):
```tsx
          pendingBannerCount={pendingCount ?? 0}
```
Delete that line.

### 7B — Admin block

- [ ] **Step 7B.1: Remove `{ count: pendingCount }` from the admin `Promise.all` destructure**

Find the admin `Promise.all` destructuring (around line 289). Remove:
```ts
    { count: pendingCount },
```

The surrounding context:
```ts
    { data: recentTx },
    { count: pendingCount },     // ← REMOVE
  ] = await Promise.all([
```

- [ ] **Step 7B.2: Remove the corresponding query from the admin `Promise.all` array**

Find and remove (around lines 303–307):
```ts
    supabase
      .from('redemption_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
```

- [ ] **Step 7B.3: Remove `initialCount` prop from the admin banner call**

Find (around line 333):
```tsx
      <PendingRedemptionsBanner initialCount={pendingCount ?? 0} />
```
Change to:
```tsx
      <PendingRedemptionsBanner />
```

- [ ] **Step 7.4: Run tests + build**

```
npm test
npm run build
```

Expected: 204 tests pass; build succeeds with no TypeScript errors.

- [ ] **Step 7.5: Commit**

```
git add app/\(admin\)/admin/dashboard/page.tsx
git commit -m "refactor: remove redundant pendingCount queries from dashboard — banner now uses context"
```

---

## Task 8: Add pending badge to `AdminNav`

**Files:**
- Modify: `components/admin/AdminNav.tsx`

- [ ] **Step 8.1: Replace the entire file content**

```tsx
// components/admin/AdminNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { usePendingRedemptions } from '@/contexts/PendingRedemptionsContext'

interface Props { role: UserRole }

export default function AdminNav({ role }: Props) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { count } = usePendingRedemptions()

  const baseLinks = [
    { href: '/admin/dashboard', label: t('admin.navDashboard') },
    { href: '/admin/customers', label: t('admin.navCustomers') },
    { href: '/admin/redemptions', label: t('admin.navRequests') },
    { href: '/admin/rewards', label: t('admin.navRewards') },
  ]
  const superadminLinks = [{ href: '/admin/staff', label: t('admin.navStaff') }]
  const links = role === 'superadmin' ? [...baseLinks, ...superadminLinks] : baseLinks

  const badgeText = count > 99 ? '99+' : String(count)

  return (
    <nav className="bg-gray-800 text-sm flex">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'flex-1 text-center py-2.5 font-medium transition-colors',
            pathname.startsWith(link.href)
              ? 'text-white border-b-2 border-brand-400'
              : 'text-gray-400 hover:text-white'
          )}
        >
          {link.href === '/admin/redemptions' ? (
            <span className="relative inline-block">
              {link.label}
              {count > 0 && (
                <span className="absolute -top-2 -right-3 bg-amber-400 text-amber-900 text-[10px] font-bold leading-none px-1 py-0.5 rounded-full min-w-[16px] text-center">
                  {badgeText}
                </span>
              )}
            </span>
          ) : (
            link.label
          )}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 8.2: Run tests**

```
npm test
```

Expected: 204 tests pass.

- [ ] **Step 8.3: Commit**

```
git add components/admin/AdminNav.tsx
git commit -m "feat: add live pending-count badge to admin nav Requests tab"
```

---

## Task 9: Final verification

- [ ] **Step 9.1: Full build**

```
npm run build
```

Expected: Build succeeds with no TypeScript or lint errors.

- [ ] **Step 9.2: Start dev server and manually verify**

```
npm run dev
```

Open `http://localhost:3000/admin/dashboard` in browser. Log in as admin or superadmin.

Checklist:
- [ ] "Requests" tab shows amber badge with current pending count (if any)
- [ ] Badge is hidden when count is 0
- [ ] Navigate away from dashboard — badge still visible on all admin pages
- [ ] Submit a test redemption request from a customer account — badge count increments within 15 s (often instantly via realtime)
- [ ] Approve/reject a request — badge count decrements
- [ ] On new request: notification beep plays (may be silent on first interaction if browser hasn't been interacted with yet — click anywhere first, then test)
- [ ] Console shows no errors

- [ ] **Step 9.3: Verify `PendingRedemptionsBanner` still works on dashboard**

- [ ] Banner appears on dashboard when pending count > 0
- [ ] Banner hides when all requests are resolved

- [ ] **Step 9.4: Final commit (if any cleanup needed, otherwise skip)**

```
git add -A
git commit -m "chore: post-integration cleanup"
```
