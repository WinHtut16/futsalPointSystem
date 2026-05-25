# Design: Member Since + Transaction DateTime (Myanmar Timezone)

**Date:** 2026-05-26  
**Status:** Approved

---

## Summary

Two small display-layer features:

1. **Member Since** — show a customer's account creation date/time on the admin customer detail page (the page opened when an admin clicks a customer's name).
2. **Transaction DateTime** — show the exact time (not just date) for every transaction in all three transaction history views, using Myanmar/Yangon timezone (UTC+6:30).
3. **Pending Request DateTime** — also show the exact time on pending redemption request rows in the customer history page (`PendingRequestItem`).

No database changes. No new components. No changes to any transaction logic or business rules.

---

## Context

### What exists today

- `profiles.created_at` is a `timestamptz NOT NULL DEFAULT now()` column — already populated for every row. The `Profile` TypeScript type already includes it. The customer detail page already fetches it via `select('*')`. It is simply never rendered.
- `lib/utils.ts` exports two formatters:
  - `formatDate(dateStr)` — date only, `en-GB` locale, no timezone → used by `TransactionItem`, `PendingRequestItem`, staff list, staff detail
  - `formatDateTime(dateStr)` — date + time, `en-GB` locale, no timezone → currently unused
- `TransactionItem` is the single shared component that renders all transaction rows in all three history views (admin dashboard recent transactions, admin customer detail page, customer history page). It calls `formatDate(tx.created_at)`.
- Neither formatter specifies a timezone, so output depends on the runtime environment's local clock (server UTC or browser local time). This is incorrect for a Myanmar-specific app.

---

## Feature 1: Member Since on Customer Detail Page

### Scope

- **Show:** On the customer profile Card at the top of `app/(admin)/admin/customers/[id]/page.tsx`, below the phone number.
- **Do not show:** On the customers list page (`app/(admin)/admin/customers/page.tsx`).
- **Format:** `"24 May 2025, 10:45 am"` — uses `formatDateTime` with Myanmar timezone.
- **Label:** i18n key `admin.memberSince` ("Member Since" / "အဖွဲ့ဝင်သည့်နေ့").

### Change

Add one line to the existing profile Card in the customer detail page:

```tsx
<p className="text-xs text-gray-400 mt-1">
  <T k="admin.memberSince" />: {formatDateTime(customer.created_at)}
</p>
```

No new component. No new query. `customer.created_at` is already in scope from the existing `select('*')`.

---

## Feature 2: Exact Time in Transaction History

### Scope

All three transaction history views use the shared `TransactionItem` component. Updating it once covers all three:

| View | File | Role |
|------|------|------|
| Admin dashboard — Recent Transactions | `app/(admin)/admin/dashboard/page.tsx` | admin/superadmin |
| Admin customer detail — Transaction History | `app/(admin)/admin/customers/[id]/page.tsx` | admin/superadmin |
| Customer history page | `app/(customer)/history/page.tsx` | customer |

**Also in scope:** `PendingRequestItem` — shows `requested_at` date for pending redemption requests on the customer history page. Updated in Feature 3 below.

### Change

In `TransactionItem.tsx`, change one import and one call:

```diff
- import { formatDate } from '@/lib/utils'
+ import { formatDateTime } from '@/lib/utils'
  ...
- <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
+ <p className="text-xs text-gray-400">{formatDateTime(tx.created_at)}</p>
```

---

## Feature 3: Exact Time on Pending Request Rows

### Scope

`components/customer/PendingRequestItem.tsx` renders each pending redemption request on the customer history page. It currently shows `formatDate(request.requested_at)` — date only.

### Change

In `PendingRequestItem.tsx`, change one import and one call:

```diff
- import { formatDate } from '@/lib/utils'
+ import { formatDateTime } from '@/lib/utils'
  ...
- <p className="text-xs text-gray-400">{formatDate(request.requested_at)}</p>
+ <p className="text-xs text-gray-400">{formatDateTime(request.requested_at)}</p>
```

---

## Shared Change: Timezone in Formatters (`lib/utils.ts`)

Both features depend on `formatDateTime` using Myanmar/Yangon timezone. The existing `formatDate` is also updated for consistency (affects staff list "Added {date}" and staff detail — an expected, correct side effect).

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

- `timeZone: 'Asia/Yangon'` — IANA identifier for Myanmar Standard Time (UTC+6:30). Works in all modern JS runtimes (Node.js, V8).
- `hour12: true` — gives AM/PM suffix (e.g. "10:45 am").
- Output examples:
  - `formatDate("2025-05-24T04:15:00Z")` → `"24 May 2025"`
  - `formatDateTime("2025-05-24T04:15:00Z")` → `"24 May 2025, 10:45 am"`

---

## i18n

Add `admin.memberSince` to both language objects in `lib/i18n/namespaces/admin.ts`:

| Key | EN | MY |
|-----|----|----|
| `admin.memberSince` | `Member Since` | `အဖွဲ့ဝင်သည့်နေ့` |

---

## Files Changed

| File | Change |
|------|--------|
| `lib/utils.ts` | Add `timeZone: 'Asia/Yangon'` to `formatDate`; add `timeZone`, `hour12` to `formatDateTime` |
| `components/customer/TransactionItem.tsx` | `formatDate` → `formatDateTime` |
| `components/customer/PendingRequestItem.tsx` | `formatDate` → `formatDateTime` |
| `app/(admin)/admin/customers/[id]/page.tsx` | Add "Member Since" row + `formatDateTime` import |
| `lib/i18n/namespaces/admin.ts` | Add `admin.memberSince` key (EN + MY) |

**Total: 5 files. No DB migration. No new components.**

---

## Non-Goals

- No changes to transaction data, logic, or APIs.
- No changes to the customers list table view.
- No changes to the admin-side redemption requests list (`RedemptionsList`, `RedemptionRequestCard`) — those are separate admin views not mentioned in scope.
- No changes to how `created_at` is stored — it already records the correct UTC timestamp at signup.
- No new icon library or date library (uses native `Intl`/`toLocaleString`).
