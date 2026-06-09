# Admin Manual Booking Entry — Design Spec
_Date: 2026-06-09 · Branch: booking-system_

## Overview

Admins can manually create bookings for phone-in or walk-in customers. The feature lives entirely in the admin panel — a "+ New Booking" button on `/admin/bookings` opens a slide-in panel (desktop) or bottom sheet (mobile) with a three-section form.

---

## 1. Database Migration (`admin-booking-entry-migration.sql`)

### Schema changes to `bookings`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `customer_id` | `uuid` | **YES** (changed) | — | Was NOT NULL; guest bookings have no linked account |
| `source` | `text` | YES | `'online'` | check: `('online','phone','walk_in','other')` |
| `guest_name` | `text` | YES | NULL | Used when `customer_id` is NULL |
| `guest_phone` | `text` | YES | NULL | Used when `customer_id` is NULL |
| `internal_notes` | `text` | YES | NULL | Admin-only; never exposed to customers |

**Migration steps:**
1. `ALTER TABLE bookings ALTER COLUMN customer_id DROP NOT NULL`
2. `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT ...` with check constraint
3. Add `guest_name`, `guest_phone`, `internal_notes` columns
4. `UPDATE bookings SET source = 'online' WHERE source IS NULL` (backfill)
5. Create `create_admin_booking_transaction` RPC (see below)

### New RPC: `create_admin_booking_transaction`

Parameters:
- `p_customer_id UUID DEFAULT NULL`
- `p_guest_name TEXT DEFAULT NULL`
- `p_guest_phone TEXT DEFAULT NULL`
- `p_booking_date DATE`
- `p_slots JSONB` — same `{hour_start, tier, price}` format as existing RPCs
- `p_deposit_total INTEGER DEFAULT 10000`
- `p_deposit_received BOOLEAN DEFAULT FALSE`
- `p_source TEXT DEFAULT 'phone'`
- `p_internal_notes TEXT DEFAULT NULL`
- `p_is_override BOOLEAN DEFAULT FALSE` — passed as `true` by the API route when pending conflicts were detected; causes slots to insert as `active=false` + `override_request=true`

Behavior:
- Validates: 1–2 slots (same as existing RPCs)
- Validates: `p_customer_id IS NOT NULL OR p_guest_name IS NOT NULL` — raises exception otherwise
- Generates `MYF-YYYY-NNNN` ref using `booking_ref_seq`
- Inserts `bookings` row with new fields
- Inserts `booking_slots` rows
- If `p_deposit_received = TRUE`: sets `status='confirmed'`, `deposit_received=true`, `confirmed_at=now()`; inserts slots with `active=true`
- If `p_deposit_received = FALSE`: sets `status='pending'`; inserts slots with `active=true`
- **Conflict handling is API-level (not RPC-level):** The API route checks for pending conflicts before calling the RPC. If conflicts exist, it calls the RPC with `p_deposit_received=false` and the RPC inserts slots with `active=false` + `override_request=true`. This has an acceptable race window for admin-created bookings. The RPC itself just inserts — no internal conflict SELECT.
- Returns JSONB: `{id, ref, status, deposit_total, price_total, had_conflict: bool}`

**Note:** Existing RPCs (`create_booking_transaction`, `create_override_booking_transaction`) are unchanged. The migration's `source DEFAULT 'online'` means those RPCs automatically write `'online'` for new customer-submitted bookings without any code changes.

### RLS impact

- `bookings_select_own_or_admin`: `auth.uid() = customer_id OR is_admin()` — guest bookings (customer_id NULL) remain admin-readable. No change needed.
- `bookings_insert_own`: `auth.uid() = customer_id OR is_admin()` — admin path still works. No change needed.

---

## 2. New API Routes

### `POST /api/admin/bookings`

Auth: `requireAnyAdmin()`

Request body (new Zod schema `AdminCreateBookingSchema`):
```ts
{
  customer_id?: string (UUID, optional)
  guest_name?: string (max 100, required if no customer_id)
  guest_phone?: string (Myanmar format if no customer_id)
  booking_date: string (YYYY-MM-DD)
  slots: number[] (1–2 ints, 6–21)
  deposit_total: number (int, 1000–500000)
  deposit_received: boolean
  source: 'phone' | 'walk_in' | 'other'
  internal_notes?: string (max 1000)
}
```

Validation:
- Either `customer_id` OR (`guest_name` + `guest_phone`) must be provided
- `booking_date` must be a valid calendar date (no past-date restriction for admin)
- `slots` 1–2 items, no duplicates

Flow:
1. Check court closures for `booking_date` — 409 if any requested slot is closed
2. Check `booking_slots` for confirmed/closed conflicts — 409 with "slot already confirmed"
3. Check for pending conflicts — note `had_conflict=true` in response (warn, don't block)
4. Recompute `tier` + `price` server-side (same as existing booking route)
5. Call `create_admin_booking_transaction` RPC
6. Return `{ id, ref, status, deposit_total, price_total, had_conflict }` with status 201

Error mapping follows existing conventions (409 for slot conflicts, 400 for validation, 500 for unexpected).

### `GET /api/admin/slot-availability?date=YYYY-MM-DD`

Auth: `requireAnyAdmin()`

Returns slot states for the admin panel's slot picker grid:
```ts
{
  slots: {
    hour: number     // 6–21
    state: 'available' | 'pending' | 'booked' | 'closed'
    tier: 'morning' | 'evening' | 'weekend'
    price: number
  }[]
}
```

Logic:
- Fetch `court_closures` for date → mark closed hours + whole-day closure
- Fetch active `booking_slots` for date, join booking status
  - `status=pending` → `'pending'`
  - `status=confirmed` → `'booked'`
  - `status=closed`/`cancelled` → ignore (slot freed)
- Remaining hours → `'available'`
- Compute tier/price using existing `tierForHour`/`priceForHour` helpers

---

## 3. UI Components

### `AdminNewBookingPanel` (`components/admin/booking/AdminNewBookingPanel.tsx`)

**Layout:** Right slide-in drawer (desktop, `w-[420px]`, `fixed inset-y-0 right-0`) / bottom sheet on mobile (full-width, `fixed bottom-0 inset-x-0`, max-height `90vh`, drag-to-dismiss optional but not required for v1). Backdrop overlay behind it. Z-index above sidebar.

Triggered by `isOpen: boolean` prop + `onClose: () => void`. Does not need to live inside `AdminBookingsList`.

**Header:** "New Booking" title + X close button.

**Section 1 — Customer**

- Phone number input (`type="tel"`, label "Customer phone")
- On input (debounce 400ms): `GET /api/customers?phone={value}` — **existing** admin endpoint, already requires admin auth, returns `{ id, username, phone }[]`
  - If match: green badge with customer name, lock-in linked mode, show "Linked to account" indicator
  - If no match after 2+ chars with a non-empty result set check: show "No account — book as guest" button beneath the input. Clicking it switches to guest mode. No auto-switch.
- Guest mode: two additional inputs appear — "Guest name" (text, required) + "Guest phone" (text, pre-filled with the searched value)
- Admin can switch back to linked mode by clearing the guest name or by searching again and finding a match

**Section 2 — Date & Time**

- Date picker (`type="date"`, default = today in Yangon TZ)
- On date change: fetch `/api/admin/slot-availability?date=` → update slot grid
- Compact slot grid: 4 columns, 16 rows (06–21). Each cell shows hour + price
  - Available: `bg-white border-gray-200 hover:border-primary` (selectable)
  - Selected: `bg-primary text-white`
  - Pending: `bg-amber-50 border-amber-200 text-amber-700 cursor-pointer` (selectable, shows warning)
  - Booked/Closed: `bg-gray-100 text-gray-400 cursor-not-allowed`
- When pending slot selected: inline amber warning strip appears below grid — "One or more slots have existing pending bookings. Confirming this booking from the list will cancel them."
- MAX 2 slots enforced; 3rd tap shows inline error

**Section 3 — Details**

- Deposit amount: number input, pre-filled `10000`, label "Deposit (MMK)", min 0
- Payment status: segmented toggle — "Deposit pending" | "Deposit received" (default: pending)
- Source: 3 pill buttons — "Phone" | "Walk-in" | "Other" (default: Phone; source='phone'/'walk_in'/'other')
- Notes: `<textarea>` rows=3, placeholder "Internal notes (not visible to customers)", max 1000 chars

**Footer:** "Create Booking" primary button + error message area. Loading spinner on submit.

**On success:** close panel, show success toast "Booking {ref} created". Realtime INSERT handler in `AdminBookingsList` picks up new row automatically.

**On conflict warning (`had_conflict=true`):** toast shows additional note "Pending conflict — confirm booking from the list to resolve."

---

### `AdminBookingsList` changes

**Type updates:**

```ts
export type AdminBooking = {
  // ...existing fields...
  source: 'online' | 'phone' | 'walk_in' | 'other' | null
  guest_name: string | null
  guest_phone: string | null
  internal_notes: string | null
}
```

`SELECT_QUERY` gains: `source, guest_name, guest_phone, internal_notes`

**Header row:** flex row with "Manage bookings" h1 left + `<AdminNewBookingPanel>` trigger button right ("+  New Booking", primary style, `Plus` Lucide icon)

**Source badge** — shown in status column (below booking status pill):
| source | style |
|--------|-------|
| `phone` | `bg-purple-100 text-purple-700` |
| `walk_in` | `bg-orange-100 text-orange-700` |
| `other` | `bg-gray-100 text-gray-600` |
| `online` | `bg-blue-100 text-blue-700` |
| null | hidden |

**Guest display:** when `booking.customer === null`, show `booking.guest_name ?? 'Guest'` as name and `booking.guest_phone ?? '—'` as phone. Avatar initials derived from guest_name.

**Internal notes expand:** each row gets a small chevron button. On click, toggles an inset notes block below (desktop: extra `<tr>` row spanning all columns; mobile: block inside card). Only shown if `internal_notes` is non-empty.

---

## 4. i18n

New keys added to `bookingEN` / `bookingMY` in `lib/i18n/namespaces/booking.ts`:

```ts
'booking.admin.newBooking': 'New Booking',
'booking.admin.newBookingTitle': 'New Booking',
'booking.admin.customerPhone': 'Customer phone',
'booking.admin.linkedAccount': 'Linked to account',
'booking.admin.guestBooking': 'Guest booking',
'booking.admin.guestName': 'Guest name',
'booking.admin.guestPhone': 'Guest phone',
'booking.admin.noAccountFound': 'No account found',
'booking.admin.pickDate': 'Date',
'booking.admin.pickSlots': 'Time slots',
'booking.admin.depositAmount': 'Deposit (MMK)',
'booking.admin.depositPending': 'Deposit pending',
'booking.admin.depositReceivedLabel': 'Deposit received',
'booking.admin.sourceLabel': 'Source',
'booking.admin.sourcePhone': 'Phone',
'booking.admin.sourceWalkIn': 'Walk-in',
'booking.admin.sourceOther': 'Other',
'booking.admin.sourceOnline': 'Online',
'booking.admin.notesLabel': 'Internal notes',
'booking.admin.notesPlaceholder': 'Not visible to customers',
'booking.admin.createBooking': 'Create Booking',
'booking.admin.bookingCreated': 'Booking {ref} created',
'booking.admin.conflictWarning': 'Has pending conflict — confirm from list to resolve',
'booking.admin.slotPendingWarning': 'One or more slots have existing pending bookings. Confirming this booking will cancel them.',
'booking.admin.maxSlotsReached': 'Maximum 2 slots per booking',
'booking.admin.guestRequired': 'Guest name and phone required',
'booking.admin.customerRequired': 'Link a customer or enter guest details',
'booking.admin.internalNotes': 'Notes',
'booking.admin.sourceCol': 'Source',
```

Myanmar translations to be regenerated via `scripts/translate.mjs`.

---

## 5. File list (new/modified)

**New files:**
- `admin-booking-entry-migration.sql`
- `app/api/admin/bookings/route.ts`
- `app/api/admin/slot-availability/route.ts`
- `components/admin/booking/AdminNewBookingPanel.tsx`

**Modified files:**
- `components/admin/booking/AdminBookingsList.tsx` — type + query + badge + guest display + notes expand + New Booking button
- `lib/schemas.ts` — add `AdminCreateBookingSchema`
- `lib/i18n/namespaces/booking.ts` — add new keys (EN + MY)

---

## 6. Validation summary

| Condition | Result |
|-----------|--------|
| No date | Block: "Date required" |
| No slots | Block: "Select at least one slot" |
| No customer + no guest name/phone | Block: "Link a customer or enter guest details" |
| Court closure on slot | 409: "One or more slots are unavailable" |
| Confirmed slot conflict | 409: "Slot already confirmed — pick another time" |
| Pending slot conflict | Allow — override path, warn in toast |
| > 2 slots | Block client-side + 400 server-side |

---

## 7. Out of scope for this feature

- Sending notifications to customers for admin-created bookings
- Editing `source` / `internal_notes` on existing bookings after creation
- Showing `internal_notes` to customers anywhere
- Admin booking > 2 slots per booking date
- Myanmar translation generation (run `scripts/translate.mjs` manually after)
