# Member Since + Transaction DateTime (Myanmar TZ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display account creation datetime ("Member Since") on the admin customer detail page, and show the full date + time (not just date) on every transaction row and pending request row, all formatted in Myanmar/Yangon timezone (UTC+6:30).

**Architecture:** All changes are pure display-layer. The `formatDate` and `formatDateTime` helpers in `lib/utils.ts` gain an explicit `timeZone: 'Asia/Yangon'` option so output is correct regardless of where the code runs (server UTC or browser local). `TransactionItem` and `PendingRequestItem` swap from `formatDate` to `formatDateTime`. The customer detail Card gets one new line using `formatDateTime`. A new i18n key `admin.memberSince` labels the field in EN and MY.

**Tech Stack:** Next.js 15 App Router, TypeScript, Vitest (unit tests), native `Intl`/`toLocaleString` (no new date library).

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `lib/utils.ts` | **Modify** | Add `timeZone: 'Asia/Yangon'` to `formatDate`; add `timeZone` + `hour12: true` to `formatDateTime` |
| `__tests__/date-formatters.test.ts` | **Create** | Unit tests for timezone-correct output of both formatters |
| `components/customer/TransactionItem.tsx` | **Modify** | `formatDate` → `formatDateTime` (one import + one call) |
| `components/customer/PendingRequestItem.tsx` | **Modify** | `formatDate` → `formatDateTime` (one import + one call) |
| `lib/i18n/namespaces/admin.ts` | **Modify** | Add `admin.memberSince` key to both `adminEN` and `adminMY` objects |
| `app/(admin)/admin/customers/[id]/page.tsx` | **Modify** | Import `formatDateTime`; add "Member Since" row in the profile Card |

---

## Task 1: Update and test the timezone-aware formatters

**Files:**
- Modify: `lib/utils.ts`
- Create: `__tests__/date-formatters.test.ts`

- [ ] **Step 1.1 — Write the failing tests**

Create `__tests__/date-formatters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from '@/lib/utils'

// UTC 2025-05-24T04:15:00Z = Myanmar (UTC+6:30) 2025-05-24 10:45 AM
const UTC_TIMESTAMP = '2025-05-24T04:15:00.000Z'

// UTC 2025-05-23T17:20:00Z = Myanmar (UTC+6:30) 2025-05-24 00:20 AM (next calendar day)
const NEAR_MIDNIGHT_UTC = '2025-05-23T17:20:00.000Z'

describe('formatDate', () => {
  it('formats date in Myanmar timezone', () => {
    expect(formatDate(UTC_TIMESTAMP)).toBe('24 May 2025')
  })

  it('uses Myanmar calendar day (not UTC day) near midnight', () => {
    // 5:20 PM UTC on May 23 is 12:20 AM May 24 in Myanmar — should show May 24
    expect(formatDate(NEAR_MIDNIGHT_UTC)).toBe('24 May 2025')
  })
})

describe('formatDateTime', () => {
  it('formats date and time in Myanmar timezone with AM/PM', () => {
    expect(formatDateTime(UTC_TIMESTAMP)).toBe('24 May 2025, 10:45 am')
  })

  it('uses Myanmar calendar day near midnight', () => {
    expect(formatDateTime(NEAR_MIDNIGHT_UTC)).toBe('24 May 2025, 12:20 am')
  })
})
```

- [ ] **Step 1.2 — Run tests to verify they fail**

```bash
npm test -- --reporter=verbose date-formatters
```

Expected: tests FAIL because `formatDate` and `formatDateTime` have no `timeZone` option yet.

- [ ] **Step 1.3 — Update `lib/utils.ts`**

Replace the existing `formatDate` and `formatDateTime` functions:

```ts
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Yangon',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Yangon',
  })
}
```

Leave `normalizePhone`, `phoneToEmail`, and `usernameToAdminEmail` untouched.

- [ ] **Step 1.4 — Run tests to verify they pass**

```bash
npm test -- --reporter=verbose date-formatters
```

Expected: all 4 tests PASS.

- [ ] **Step 1.5 — Run the full test suite to check for regressions**

```bash
npm test
```

Expected: all existing tests still pass (the formatter change does not affect any API or middleware tests).

- [ ] **Step 1.6 — Commit**

```bash
git add lib/utils.ts __tests__/date-formatters.test.ts
git commit -m "feat: add Myanmar timezone (Asia/Yangon) to formatDate and formatDateTime"
```

---

## Task 2: Show time in transaction history rows

**Files:**
- Modify: `components/customer/TransactionItem.tsx:4,56`

- [ ] **Step 2.1 — Update the import**

In `components/customer/TransactionItem.tsx`, change line 4:

```diff
- import { formatDate } from '@/lib/utils'
+ import { formatDateTime } from '@/lib/utils'
```

- [ ] **Step 2.2 — Update the call**

Change line 56 (the date paragraph inside the component):

```diff
- <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
+ <p className="text-xs text-gray-400">{formatDateTime(tx.created_at)}</p>
```

- [ ] **Step 2.3 — Run the test suite**

```bash
npm test
```

Expected: all tests pass (no test directly renders TransactionItem, so no snapshot diffs).

- [ ] **Step 2.4 — Commit**

```bash
git add components/customer/TransactionItem.tsx
git commit -m "feat: show full datetime (Myanmar TZ) in transaction history rows"
```

---

## Task 3: Show time on pending redemption request rows

**Files:**
- Modify: `components/customer/PendingRequestItem.tsx:5,40`

- [ ] **Step 3.1 — Update the import**

In `components/customer/PendingRequestItem.tsx`, change line 5:

```diff
- import { formatDate } from '@/lib/utils'
+ import { formatDateTime } from '@/lib/utils'
```

- [ ] **Step 3.2 — Update the call**

Change line 40 (the `requested_at` paragraph):

```diff
- <p className="text-xs text-gray-400">{formatDate(request.requested_at)}</p>
+ <p className="text-xs text-gray-400">{formatDateTime(request.requested_at)}</p>
```

- [ ] **Step 3.3 — Run the test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3.4 — Commit**

```bash
git add components/customer/PendingRequestItem.tsx
git commit -m "feat: show full datetime (Myanmar TZ) on pending redemption request rows"
```

---

## Task 4: Add the "Member Since" i18n key

**Files:**
- Modify: `lib/i18n/namespaces/admin.ts`

The existing test `__tests__/i18n-structure.test.ts` automatically verifies that every EN key has a matching MY key. It will catch any mismatch after this change.

- [ ] **Step 4.1 — Add the key to `adminEN`**

In `lib/i18n/namespaces/admin.ts`, inside the `adminEN` object, add after the `'admin.backToCustomers'` entry (around line 117):

```ts
// Customer detail page
'admin.backToCustomers': '← Customers',
'admin.memberSince': 'Member Since',   // ← add this line
'admin.addPointsSection': 'Add Points',
```

- [ ] **Step 4.2 — Add the key to `adminMY`**

In the same file, inside the `adminMY` object, add after the `'admin.backToCustomers'` entry (around line 281):

```ts
'admin.backToCustomers': '← ဖောက်သည်များ',
'admin.memberSince': 'အဖွဲ့ဝင်သည့်နေ့',   // ← add this line
'admin.addPointsSection': 'အမှတ်ထည့်ရန်',
```

- [ ] **Step 4.3 — Run the test suite to verify key parity**

```bash
npm test
```

Expected: all tests pass, including `i18n-structure` which checks EN/MY key parity.

- [ ] **Step 4.4 — Commit**

```bash
git add lib/i18n/namespaces/admin.ts
git commit -m "feat: add admin.memberSince i18n key (EN + MY)"
```

---

## Task 5: Add "Member Since" to the customer detail page

**Files:**
- Modify: `app/(admin)/admin/customers/[id]/page.tsx`

`customer.created_at` is already fetched by the existing `select('*')` query. No query change needed.

- [ ] **Step 5.1 — Add the `formatDateTime` import**

In `app/(admin)/admin/customers/[id]/page.tsx`, there is currently no import from `@/lib/utils`. Add one at the top of the import block (after the last `import` line):

```ts
import { formatDateTime } from '@/lib/utils'
```

The full import block should then look like:

```ts
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Card from '@/components/ui/Card'
import TransactionItem from '@/components/customer/TransactionItem'
import AddPointsForm from '@/components/admin/AddPointsForm'
import AdjustPointsForm from '@/components/admin/AdjustPointsForm'
import ResetPasswordForm from '@/components/admin/ResetPasswordForm'
import DeleteCustomerButton from '@/components/admin/DeleteCustomerButton'
import T from '@/components/ui/T'
import { formatDateTime } from '@/lib/utils'
import type { PointTransaction } from '@/types'
import Link from 'next/link'
```

- [ ] **Step 5.2 — Add the "Member Since" row to the profile Card**

The profile Card currently renders (lines 43–49):

```tsx
<Card>
  <p className="text-xl font-bold text-gray-900">{customer.username}</p>
  <p className="text-sm text-gray-500">{customer.phone}</p>
  <p className="text-3xl font-bold text-brand-600 mt-3">
    {customer.total_points.toLocaleString()} <span className="text-base font-normal text-gray-400"><T k="common.pts" /></span>
  </p>
</Card>
```

Add the "Member Since" line immediately after the phone number:

```tsx
<Card>
  <p className="text-xl font-bold text-gray-900">{customer.username}</p>
  <p className="text-sm text-gray-500">{customer.phone}</p>
  <p className="text-xs text-gray-400 mt-0.5">
    <T k="admin.memberSince" />: {formatDateTime(customer.created_at)}
  </p>
  <p className="text-3xl font-bold text-brand-600 mt-3">
    {customer.total_points.toLocaleString()} <span className="text-base font-normal text-gray-400"><T k="common.pts" /></span>
  </p>
</Card>
```

- [ ] **Step 5.3 — Run the test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5.4 — Commit**

```bash
git add app/(admin)/admin/customers/[id]/page.tsx
git commit -m "feat: show Member Since datetime on admin customer detail page"
```

---

## Verification checklist (manual, after all tasks)

Start the dev server (`npm run dev`) and check the following in the browser:

- [ ] **Admin customer detail page** (`/admin/customers/[id]`): profile card shows "Member Since: 24 May 2025, 10:45 am" (example values) below the phone number, in correct Myanmar time.
- [ ] **Admin dashboard** (`/admin/dashboard`): Recent Transactions rows show datetime ("24 May 2025, 10:45 am"), not just date.
- [ ] **Admin customer detail page** (same page): Transaction History section rows show datetime, not just date.
- [ ] **Customer history page** (`/history`): Transaction rows show datetime, not just date.
- [ ] **Customer history page** (`/history`): Pending request rows (yellow ⏳ items) show datetime, not just date.
- [ ] **Language toggle**: switching to Myanmar language shows "အဖွဲ့ဝင်သည့်နေ့" label on the customer detail page.
- [ ] **Time correctness**: if the server is in UTC, confirm a known transaction timestamp displays as Myanmar time (UTC+6:30 ahead), not UTC.
