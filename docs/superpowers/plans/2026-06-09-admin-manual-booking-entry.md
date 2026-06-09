# Admin Manual Booking Entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "+ New Booking" button to `/admin/bookings` that opens a panel for creating manual bookings for phone/walk-in customers, with optional guest mode (no linked account).

**Architecture:** New `create_admin_booking_transaction` Supabase RPC handles all creation logic. A new `POST /api/admin/bookings` route (admin-only) wraps it. `AdminNewBookingPanel` is a standalone client component mounted inside `AdminBookingsList`. The existing realtime INSERT handler in `AdminBookingsList` picks up new rows automatically — no direct coupling needed.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (SQL + RPC + realtime), Zod, Tailwind CSS, Lucide icons, Vitest unit tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `admin-booking-entry-migration.sql` | Create | Schema changes + `create_admin_booking_transaction` RPC |
| `lib/schemas.ts` | Modify | Add `AdminCreateBookingSchema` |
| `lib/i18n/namespaces/booking.ts` | Modify | Add EN + MY keys for new UI |
| `app/api/admin/slot-availability/route.ts` | Create | GET: slot states for a given date (admin-only) |
| `app/api/admin/bookings/route.ts` | Create | POST: create admin booking (admin-only) |
| `components/admin/booking/AdminNewBookingPanel.tsx` | Create | Slide-in panel / bottom sheet UI |
| `components/admin/booking/AdminBookingsList.tsx` | Modify | Type + query + source badge + guest display + notes expand + New Booking button |
| `app/(admin)/admin/bookings/page.tsx` | Modify | SELECT cols + row mapping for new fields |
| `__tests__/api-privilege-escalation.test.ts` | Modify | Auth guard tests for two new routes |
| `__tests__/api-validation.test.ts` | Modify | Input validation tests for POST /api/admin/bookings |

---

## Task 1: DB Migration

**Files:**
- Create: `admin-booking-entry-migration.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- admin-booking-entry-migration.sql
-- Run AFTER all previous migrations in Supabase SQL editor.

-- 1. Make customer_id nullable (guest bookings have no linked account)
ALTER TABLE public.bookings
  ALTER COLUMN customer_id DROP NOT NULL;

-- 2. Add source column with check constraint and default
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IN ('online','phone','walk_in','other'))
    DEFAULT 'online';

-- 3. Add guest fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- 4. Add internal notes (admin-only, never shown to customers)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 5. Backfill source for all existing bookings
UPDATE public.bookings SET source = 'online' WHERE source IS NULL;

-- 6. New RPC: create_admin_booking_transaction
--    Used by POST /api/admin/bookings (admin-only route).
--    Differs from create_booking_transaction in:
--      - customer_id optional (guest bookings)
--      - accepts source, guest_name, guest_phone, internal_notes
--      - accepts deposit_total override and deposit_received flag
--      - p_is_override=true inserts slots active=false + override_request=true
--        (same mechanism as create_override_booking_transaction)
CREATE OR REPLACE FUNCTION public.create_admin_booking_transaction(
  p_customer_id     UUID    DEFAULT NULL,
  p_guest_name      TEXT    DEFAULT NULL,
  p_guest_phone     TEXT    DEFAULT NULL,
  p_booking_date    DATE,
  p_slots           JSONB,
  p_deposit_total   INTEGER DEFAULT 10000,
  p_deposit_received BOOLEAN DEFAULT FALSE,
  p_source          TEXT    DEFAULT 'phone',
  p_internal_notes  TEXT    DEFAULT NULL,
  p_is_override     BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id  UUID;
  v_ref         TEXT;
  v_slot        JSONB;
  v_price_total NUMERIC := 0;
  v_status      TEXT;
  v_active      BOOLEAN;
BEGIN
  -- Validate: must supply either a linked customer or a guest name
  IF p_customer_id IS NULL AND (p_guest_name IS NULL OR trim(p_guest_name) = '') THEN
    RAISE EXCEPTION 'customer_required';
  END IF;

  -- Validate slot count (mirrors create_booking_transaction)
  IF jsonb_array_length(p_slots) < 1 OR jsonb_array_length(p_slots) > 2 THEN
    RAISE EXCEPTION 'A booking must contain 1 or 2 slots (got %).', jsonb_array_length(p_slots);
  END IF;

  -- Generate MYF-YYYY-NNNN ref using the shared sequence
  v_ref := 'MYF-' || to_char(p_booking_date, 'YYYY') || '-'
           || lpad(nextval('public.booking_ref_seq')::text, 4, '0');

  -- Compute total price from slot payloads
  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    v_price_total := v_price_total + (v_slot->>'price')::NUMERIC;
  END LOOP;

  -- Determine status and whether slots are active
  IF p_is_override THEN
    -- Override: slot claimed inactive; admin confirms later which cancels
    -- the conflicting pending booking (existing confirm_override_booking mechanism)
    v_status := 'pending';
    v_active  := false;
  ELSIF p_deposit_received THEN
    v_status := 'confirmed';
    v_active  := true;
  ELSE
    v_status := 'pending';
    v_active  := true;
  END IF;

  -- Insert booking row
  INSERT INTO public.bookings (
    ref,
    customer_id,
    guest_name,
    guest_phone,
    booking_date,
    status,
    deposit_total,
    price_total,
    deposit_received,
    override_request,
    source,
    internal_notes,
    confirmed_at
  ) VALUES (
    v_ref,
    p_customer_id,
    p_guest_name,
    p_guest_phone,
    p_booking_date,
    v_status,
    p_deposit_total,
    v_price_total::INTEGER,
    CASE WHEN p_is_override THEN false ELSE p_deposit_received END,
    p_is_override,
    p_source,
    p_internal_notes,
    CASE WHEN NOT p_is_override AND p_deposit_received THEN now() ELSE NULL END
  ) RETURNING id INTO v_booking_id;

  -- Insert slot rows (booking_date is a NOT NULL column on booking_slots)
  FOR v_slot IN SELECT value FROM jsonb_array_elements(p_slots) LOOP
    INSERT INTO public.booking_slots (booking_id, booking_date, hour_start, tier, price, active)
    VALUES (
      v_booking_id,
      p_booking_date,
      (v_slot->>'hour_start')::INT,
      v_slot->>'tier',
      (v_slot->>'price')::INT,
      v_active
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id',            v_booking_id,
    'ref',           v_ref,
    'status',        v_status,
    'deposit_total', p_deposit_total,
    'price_total',   v_price_total::INTEGER,
    'had_conflict',  p_is_override
  );
END;
$$;
```

- [ ] **Step 2: Run in Supabase SQL editor**

Copy the file contents into the Supabase SQL editor and execute. Verify no errors. Check that `\d bookings` (or the table viewer) shows the four new columns and nullable `customer_id`.

- [ ] **Step 3: Commit**

```bash
git add admin-booking-entry-migration.sql
git commit -m "feat(db): add guest/source columns and create_admin_booking_transaction RPC"
```

---

## Task 2: Zod Schema

**Files:**
- Modify: `lib/schemas.ts`

- [ ] **Step 1: Add `AdminCreateBookingSchema` after `CreateBookingSchema`**

Open `lib/schemas.ts`. After the closing of `CreateBookingSchema` (line 91), insert:

```ts
export const AdminCreateBookingSchema = z
  .object({
    customer_id: uuid.optional(),
    guest_name: z.string().trim().max(100, 'Guest name is too long.').optional(),
    guest_phone: z.string().trim().max(20, 'Guest phone is too long.').optional(),
    booking_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format.')
      .refine((val) => {
        const d = new Date(val)
        return !isNaN(d.getTime()) && val === d.toISOString().slice(0, 10)
      }, 'Invalid calendar date.'),
    slots: z
      .array(z.number().int().min(6, 'Invalid slot.').max(21, 'Invalid slot.'))
      .min(1, 'Select at least one slot.')
      .max(2, 'Maximum 2 slots per booking.')
      .refine((arr) => new Set(arr).size === arr.length, { message: 'Duplicate slots.' }),
    deposit_total: z
      .number({ message: 'Deposit must be a number.' })
      .int('Deposit must be an integer.')
      .min(0, 'Deposit cannot be negative.')
      .max(500_000, 'Deposit is too large.'),
    deposit_received: z.boolean({ message: 'deposit_received must be a boolean.' }),
    source: z.enum(['phone', 'walk_in', 'other'], { message: 'Invalid source.' }),
    internal_notes: z.string().trim().max(1000, 'Notes are too long.').optional(),
  })
  .refine(
    (d) =>
      d.customer_id !== undefined ||
      (d.guest_name !== undefined && d.guest_name.trim().length > 0),
    { message: 'Link a customer or enter guest details.', path: ['customer_id'] }
  )
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors on `lib/schemas.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas.ts
git commit -m "feat(schema): add AdminCreateBookingSchema"
```

---

## Task 3: i18n Keys

**Files:**
- Modify: `lib/i18n/namespaces/booking.ts`

- [ ] **Step 1: Add EN keys to `bookingEN`**

In `lib/i18n/namespaces/booking.ts`, inside the `bookingEN` object (before the closing `}` of the object), add:

```ts
  // Admin — manual booking panel
  'booking.admin.newBooking': 'New Booking',
  'booking.admin.newBookingTitle': 'New Booking',
  'booking.admin.customerPhone': 'Customer phone',
  'booking.admin.linkedAccount': 'Linked to account',
  'booking.admin.guestBooking': 'Guest booking',
  'booking.admin.guestName': 'Guest name',
  'booking.admin.guestPhone': 'Guest phone (optional)',
  'booking.admin.noAccountFound': 'No account found',
  'booking.admin.bookAsGuest': 'Book as guest',
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
  'booking.admin.guestRequired': 'Guest name is required',
  'booking.admin.customerRequired': 'Link a customer or enter guest details',
  'booking.admin.internalNotes': 'Notes',
  'booking.admin.sourceCol': 'Source',
  'booking.admin.switchToLinked': 'Cancel',
```

- [ ] **Step 2: Add MY keys to `bookingMY`**

In the same file, inside `bookingMY`, add the same keys with Myanmar translations (placeholder same as EN — run `scripts/translate.mjs` to regenerate properly):

```ts
  // Admin — manual booking panel (run scripts/translate.mjs to update)
  'booking.admin.newBooking': 'ဘွတ်ကင်အသစ်',
  'booking.admin.newBookingTitle': 'ဘွတ်ကင်အသစ်',
  'booking.admin.customerPhone': 'ဖောက်သည် ဖုန်းနံပါတ်',
  'booking.admin.linkedAccount': 'အကောင့်နှင့် ချိတ်ဆက်ထား',
  'booking.admin.guestBooking': 'ဧည့်သည် ဘွတ်ကင်',
  'booking.admin.guestName': 'ဧည့်သည် အမည်',
  'booking.admin.guestPhone': 'ဧည့်သည် ဖုန်း (ရွေးချယ်နိုင်)',
  'booking.admin.noAccountFound': 'အကောင့် မတွေ့ပါ',
  'booking.admin.bookAsGuest': 'ဧည့်သည်အဖြစ် မှာကြားမည်',
  'booking.admin.pickDate': 'ရက်စွဲ',
  'booking.admin.pickSlots': 'အချိန်ကွက်များ',
  'booking.admin.depositAmount': 'စရံငွေ (MMK)',
  'booking.admin.depositPending': 'စရံငွေ ဆိုင်းငံ့နေ',
  'booking.admin.depositReceivedLabel': 'စရံငွေ ရရှိပြီး',
  'booking.admin.sourceLabel': 'ရင်းမြစ်',
  'booking.admin.sourcePhone': 'ဖုန်း',
  'booking.admin.sourceWalkIn': 'တိုက်ရိုက်လာ',
  'booking.admin.sourceOther': 'အခြား',
  'booking.admin.sourceOnline': 'အွန်လိုင်း',
  'booking.admin.notesLabel': 'မှတ်စုများ',
  'booking.admin.notesPlaceholder': 'ဖောက်သည်မြင်နိုင်မည် မဟုတ်ပါ',
  'booking.admin.createBooking': 'ဘွတ်ကင်ဖန်တီးရန်',
  'booking.admin.bookingCreated': 'ဘွတ်ကင် {ref} ဖန်တီးပြီး',
  'booking.admin.conflictWarning': 'ဆိုင်းငံ့မှု ရှိနေ — စာရင်းမှ အတည်ပြုပါ',
  'booking.admin.slotPendingWarning': 'ရွေးချယ်ထားသော အချိန်တွင် ဆိုင်းငံ့ဘွတ်ကင် ရှိနေသည်။ ဤဘွတ်ကင်ကို အတည်ပြုပါက ၎င်းကို ပယ်ဖျက်မည်။',
  'booking.admin.maxSlotsReached': 'အများဆုံး ၂ ကွက်',
  'booking.admin.guestRequired': 'ဧည့်သည် အမည် လိုအပ်သည်',
  'booking.admin.customerRequired': 'ဖောက်သည် ချိတ်ဆက်ပါ သို့မဟုတ် ဧည့်သည် အချက်အလက် ထည့်ပါ',
  'booking.admin.internalNotes': 'မှတ်စု',
  'booking.admin.sourceCol': 'ရင်းမြစ်',
  'booking.admin.switchToLinked': 'ပယ်ဖျက်',
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/namespaces/booking.ts
git commit -m "feat(i18n): add admin manual booking panel keys"
```

---

## Task 4: Slot Availability API Route

**Files:**
- Create: `app/api/admin/slot-availability/route.ts`
- Modify: `__tests__/api-privilege-escalation.test.ts`

- [ ] **Step 1: Create the directory**

```bash
New-Item -ItemType Directory -Force "app/api/admin/slot-availability"
```

- [ ] **Step 2: Write the route**

Create `app/api/admin/slot-availability/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { serverError } from '@/lib/schemas'
import { tierForHour, priceForHour, dayHours } from '@/lib/booking'

export async function GET(request: NextRequest) {
  try {
    await requireAnyAdmin()

    const date = new URL(request.url).searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date param required (YYYY-MM-DD).' }, { status: 400 })
    }
    const parsed = new Date(date)
    if (isNaN(parsed.getTime()) || date !== parsed.toISOString().slice(0, 10)) {
      return NextResponse.json({ error: 'Invalid calendar date.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const [closuresResult, slotsResult] = await Promise.all([
      supabase.from('court_closures').select('hour_start').eq('closure_date', date),
      supabase
        .from('booking_slots')
        .select('hour_start, booking_id')
        .eq('booking_date', date)
        .eq('active', true),
    ])

    if (closuresResult.error) return serverError(closuresResult.error.message)
    if (slotsResult.error) return serverError(slotsResult.error.message)

    const dayClosed = (closuresResult.data ?? []).some((c) => c.hour_start == null)
    const closedHours = new Set(
      (closuresResult.data ?? [])
        .map((c) => c.hour_start)
        .filter((h): h is number => h != null)
    )

    // Fetch booking statuses for active slots
    const bookingIds = (slotsResult.data ?? []).map((s) => s.booking_id as string)
    const statusMap = new Map<string, string>()
    if (bookingIds.length > 0) {
      const { data: bookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('id, status')
        .in('id', bookingIds)
      if (bookingsErr) return serverError(bookingsErr.message)
      for (const b of bookings ?? []) statusMap.set(b.id as string, b.status as string)
    }

    const pendingHours = new Set<number>()
    const bookedHours = new Set<number>()
    for (const slot of slotsResult.data ?? []) {
      const status = statusMap.get(slot.booking_id as string)
      if (status === 'pending') pendingHours.add(slot.hour_start as number)
      else if (status === 'confirmed') bookedHours.add(slot.hour_start as number)
    }

    const slots = dayHours().map((hour) => {
      let state: 'available' | 'pending' | 'booked' | 'closed'
      if (dayClosed || closedHours.has(hour)) state = 'closed'
      else if (bookedHours.has(hour)) state = 'booked'
      else if (pendingHours.has(hour)) state = 'pending'
      else state = 'available'
      return { hour, state, tier: tierForHour(date, hour), price: priceForHour(date, hour) }
    })

    return NextResponse.json({ slots })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
```

- [ ] **Step 3: Add privilege-escalation tests**

In `__tests__/api-privilege-escalation.test.ts`, add this `describe` block before the final closing brace of the file:

```ts
describe('GET /api/admin/slot-availability', () => {
  it('returns 401 when unauthenticated', async () => {
    unauth()
    const { GET } = await import('@/app/api/admin/slot-availability/route')
    const req = new NextRequest('http://localhost/api/admin/slot-availability?date=2026-07-01')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when called by a customer', async () => {
    asCustomer()
    const { GET } = await import('@/app/api/admin/slot-availability/route')
    const req = new NextRequest('http://localhost/api/admin/slot-availability?date=2026-07-01')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 4: Run the tests**

```bash
npm test -- api-privilege-escalation
```

Expected: all tests pass including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/slot-availability/route.ts __tests__/api-privilege-escalation.test.ts
git commit -m "feat(api): add GET /api/admin/slot-availability"
```

---

## Task 5: Admin Bookings API Route

**Files:**
- Create: `app/api/admin/bookings/route.ts`
- Modify: `__tests__/api-privilege-escalation.test.ts`
- Modify: `__tests__/api-validation.test.ts`

- [ ] **Step 1: Create the directory**

```bash
New-Item -ItemType Directory -Force "app/api/admin/bookings"
```

- [ ] **Step 2: Write the route**

Create `app/api/admin/bookings/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAnyAdmin } from '@/lib/auth'
import { AdminCreateBookingSchema, badRequest, parseJson, serverError } from '@/lib/schemas'
import { priceForHour, tierForHour } from '@/lib/booking'

export async function POST(request: NextRequest) {
  try {
    await requireAnyAdmin()

    const parsed = AdminCreateBookingSchema.safeParse(await parseJson(request))
    if (!parsed.success) return badRequest(parsed.error)

    const {
      customer_id,
      guest_name,
      guest_phone,
      booking_date,
      slots,
      deposit_total,
      deposit_received,
      source,
      internal_notes,
    } = parsed.data

    const supabase = createServiceClient()

    // Check court closures — hard block
    const { data: closures } = await supabase
      .from('court_closures')
      .select('hour_start')
      .eq('closure_date', booking_date)

    if (closures && closures.length > 0) {
      const dayClosed = closures.some((c) => c.hour_start == null)
      const closedHours = new Set(
        closures.map((c) => c.hour_start).filter((h): h is number => h != null)
      )
      if (dayClosed || slots.some((h) => closedHours.has(h))) {
        return NextResponse.json({ error: 'One or more slots are unavailable.' }, { status: 409 })
      }
    }

    // Check for confirmed/closed conflicts — hard block
    // Check for pending conflicts — soft (override path)
    const { data: activeSlots, error: slotsErr } = await supabase
      .from('booking_slots')
      .select('hour_start, booking_id')
      .eq('booking_date', booking_date)
      .eq('active', true)
      .in('hour_start', slots)

    if (slotsErr) return serverError(slotsErr.message)

    let hadConflict = false
    if ((activeSlots ?? []).length > 0) {
      const bookingIds = (activeSlots ?? []).map((s) => s.booking_id as string)
      const { data: existingBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('id, status')
        .in('id', bookingIds)
        .eq('booking_date', booking_date)

      if (bookingsErr) return serverError(bookingsErr.message)

      const hasConfirmed = (existingBookings ?? []).some(
        (b) => b.status === 'confirmed' || b.status === 'closed'
      )
      if (hasConfirmed) {
        return NextResponse.json(
          { error: 'Slot already confirmed — pick another time.' },
          { status: 409 }
        )
      }
      hadConflict = true
    }

    // Server-side recompute of tier + price (never trust client-supplied prices)
    const slotPayload = slots
      .slice()
      .sort((a, b) => a - b)
      .map((hour) => ({
        hour_start: hour,
        tier: tierForHour(booking_date, hour),
        price: priceForHour(booking_date, hour),
      }))

    const { data, error } = await supabase.rpc('create_admin_booking_transaction', {
      p_customer_id: customer_id ?? null,
      p_guest_name: guest_name ?? null,
      p_guest_phone: guest_phone ?? null,
      p_booking_date: booking_date,
      p_slots: slotPayload,
      p_deposit_total: deposit_total,
      p_deposit_received: hadConflict ? false : deposit_received,
      p_source: source,
      p_internal_notes: internal_notes ?? null,
      p_is_override: hadConflict,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'One or more of those slots were just taken. Please pick another time.' },
          { status: 409 }
        )
      }
      if (error.message?.includes('slot_closed')) {
        return NextResponse.json(
          { error: 'This slot has been closed by the court. Please choose another time.' },
          { status: 409 }
        )
      }
      if (error.message?.includes('customer_required')) {
        return NextResponse.json(
          { error: 'Link a customer or enter guest details.' },
          { status: 400 }
        )
      }
      return serverError(error.message)
    }

    const booking = Array.isArray(data) ? data[0] : data
    return NextResponse.json(
      {
        id: booking?.id,
        ref: booking?.ref,
        status: booking?.status,
        deposit_total: booking?.deposit_total,
        price_total: booking?.price_total,
        had_conflict: hadConflict,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
}
```

- [ ] **Step 3: Add privilege-escalation tests**

In `__tests__/api-privilege-escalation.test.ts`, add inside the file (before the last `}`):

```ts
describe('POST /api/admin/bookings', () => {
  const validBody = {
    guest_name: 'Ko Aung',
    booking_date: '2026-08-15',
    slots: [10],
    deposit_total: 10000,
    deposit_received: false,
    source: 'phone',
  }

  it('returns 401 when unauthenticated', async () => {
    unauth()
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = jsonReq('http://localhost/api/admin/bookings', 'POST', validBody)
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when called by a customer', async () => {
    asCustomer()
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = jsonReq('http://localhost/api/admin/bookings', 'POST', validBody)
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 4: Add validation tests**

In `__tests__/api-validation.test.ts`, add a new `describe` block at the end (before the final `}`):

```ts
describe('POST /api/admin/bookings — validation', () => {
  const validBase = {
    guest_name: 'Ko Aung',
    booking_date: '2026-08-15',
    slots: [10],
    deposit_total: 10000,
    deposit_received: false,
    source: 'phone',
  }

  beforeEach(() => as.admin())

  it('returns 400 when no body', async () => {
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = new NextRequest('http://localhost/api/admin/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when no customer_id and no guest_name', async () => {
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = jsonReq('http://localhost/api/admin/bookings', 'POST', {
      ...validBase,
      guest_name: undefined,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when slots is empty array', async () => {
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = jsonReq('http://localhost/api/admin/bookings', 'POST', { ...validBase, slots: [] })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when slots has more than 2 items', async () => {
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = jsonReq('http://localhost/api/admin/bookings', 'POST', { ...validBase, slots: [9, 10, 11] })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when booking_date is invalid', async () => {
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = jsonReq('http://localhost/api/admin/bookings', 'POST', { ...validBase, booking_date: 'not-a-date' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when source is invalid', async () => {
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = jsonReq('http://localhost/api/admin/bookings', 'POST', { ...validBase, source: 'online' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for oversized notes', async () => {
    const { POST } = await import('@/app/api/admin/bookings/route')
    const req = jsonReq('http://localhost/api/admin/bookings', 'POST', {
      ...validBase,
      internal_notes: 'x'.repeat(1001),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

Note: the `jsonReq` helper is already defined in `api-privilege-escalation.test.ts`. For `api-validation.test.ts`, check that `jsonReq` is already defined there too (search the file — if missing, define it the same way as in the privilege escalation file).

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all 268 existing tests + new tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/bookings/route.ts __tests__/api-privilege-escalation.test.ts __tests__/api-validation.test.ts
git commit -m "feat(api): add POST /api/admin/bookings"
```

---

## Task 6: AdminNewBookingPanel Component

**Files:**
- Create: `components/admin/booking/AdminNewBookingPanel.tsx`

- [ ] **Step 1: Create the component file**

Create `components/admin/booking/AdminNewBookingPanel.tsx`:

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Check, Search, AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { dayHours, MAX_SLOTS, DEPOSIT_PER_SLOT } from '@/lib/booking'

type SlotState = 'available' | 'pending' | 'booked' | 'closed'

type SlotInfo = {
  hour: number
  state: SlotState
  tier: 'morning' | 'evening' | 'weekend'
  price: number
}

type CustomerMatch = { id: string; username: string | null; phone: string | null }

function todayYangon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const pad = (n: number) => String(n).padStart(2, '0')

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (ref: string, hadConflict: boolean) => void
}

export default function AdminNewBookingPanel({ isOpen, onClose, onSuccess }: Props) {
  const { t } = useLanguage()

  // Section 1: Customer
  const [phoneQuery, setPhoneQuery] = useState('')
  const [customerMatch, setCustomerMatch] = useState<CustomerMatch | null>(null)
  const [noMatch, setNoMatch] = useState(false)
  const [guestMode, setGuestMode] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Section 2: Date & Slots
  const [date, setDate] = useState(todayYangon)
  const [slotData, setSlotData] = useState<SlotInfo[] | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedHours, setSelectedHours] = useState<number[]>([])
  const [maxSlotsError, setMaxSlotsError] = useState(false)

  const hasPendingConflict = selectedHours.some(
    (h) => slotData?.find((s) => s.hour === h)?.state === 'pending'
  )

  // Section 3: Details
  const [depositTotal, setDepositTotal] = useState(DEPOSIT_PER_SLOT)
  const [depositReceived, setDepositReceived] = useState(false)
  const [source, setSource] = useState<'phone' | 'walk_in' | 'other'>('phone')
  const [notes, setNotes] = useState('')

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchSlots = useCallback(async (d: string) => {
    setLoadingSlots(true)
    setSelectedHours([])
    setMaxSlotsError(false)
    try {
      const res = await fetch(`/api/admin/slot-availability?date=${d}`)
      if (res.ok) {
        const json = await res.json()
        setSlotData(json.slots as SlotInfo[])
      } else {
        setSlotData(null)
      }
    } catch {
      setSlotData(null)
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  // Fetch slots whenever date changes (and panel is open)
  useEffect(() => {
    if (isOpen && date) fetchSlots(date)
  }, [isOpen, date, fetchSlots])

  // Reset all state when panel opens
  useEffect(() => {
    if (!isOpen) return
    setPhoneQuery('')
    setCustomerMatch(null)
    setNoMatch(false)
    setGuestMode(false)
    setGuestName('')
    setGuestPhone('')
    setDate(todayYangon())
    setSlotData(null)
    setSelectedHours([])
    setMaxSlotsError(false)
    setDepositTotal(DEPOSIT_PER_SLOT)
    setDepositReceived(false)
    setSource('phone')
    setNotes('')
    setSubmitError(null)
  }, [isOpen])

  function handlePhoneChange(value: string) {
    setPhoneQuery(value)
    setCustomerMatch(null)
    setNoMatch(false)
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current)
    if (value.length >= 2) {
      phoneDebounce.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/customers?phone=${encodeURIComponent(value)}`)
          if (res.ok) {
            const customers: CustomerMatch[] = await res.json()
            if (customers.length > 0) {
              setCustomerMatch(customers[0])
              setNoMatch(false)
            } else {
              setNoMatch(true)
            }
          }
        } catch {
          // silent — user can still proceed in guest mode
        }
      }, 400)
    }
  }

  function handleSlotClick(hour: number, state: SlotState) {
    if (state === 'booked' || state === 'closed') return
    setMaxSlotsError(false)
    setSelectedHours((prev) => {
      if (prev.includes(hour)) return prev.filter((h) => h !== hour)
      if (prev.length >= MAX_SLOTS) {
        setMaxSlotsError(true)
        return prev
      }
      return [...prev, hour]
    })
  }

  async function handleSubmit() {
    setSubmitError(null)

    if (!date) { setSubmitError('Date required.'); return }
    if (selectedHours.length === 0) { setSubmitError('Select at least one slot.'); return }
    if (!customerMatch && !guestMode) {
      setSubmitError(t('booking.admin.customerRequired' as never))
      return
    }
    if (guestMode && !guestName.trim()) {
      setSubmitError(t('booking.admin.guestRequired' as never))
      return
    }

    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        booking_date: date,
        slots: selectedHours,
        deposit_total: depositTotal,
        deposit_received: depositReceived,
        source,
      }
      if (notes.trim()) body.internal_notes = notes.trim()
      if (customerMatch && !guestMode) {
        body.customer_id = customerMatch.id
      } else {
        body.guest_name = guestName.trim()
        if (guestPhone.trim()) body.guest_phone = guestPhone.trim()
      }

      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Failed to create booking.')
        return
      }
      onSuccess(json.ref as string, json.had_conflict as boolean)
      onClose()
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  function slotTileClass(slot: SlotInfo): string {
    const selected = selectedHours.includes(slot.hour)
    if (selected) return 'bg-primary text-white border-primary'
    if (slot.state === 'booked' || slot.state === 'closed')
      return 'bg-gray-100 text-gray-400 cursor-not-allowed border-transparent'
    if (slot.state === 'pending')
      return 'bg-amber-50 border-amber-200 text-amber-700 cursor-pointer hover:border-amber-400'
    return 'bg-white border-gray-200 text-gray-700 cursor-pointer hover:border-primary'
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel: bottom sheet on mobile, right drawer on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl md:inset-x-auto md:inset-y-0 md:bottom-auto md:right-0 md:max-h-none md:w-[420px] md:overflow-y-auto md:rounded-none md:rounded-l-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 className="text-base font-bold text-gray-900">
            {t('booking.admin.newBookingTitle' as never)}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4 pb-8">
          {/* ── Section 1: Customer ─────────────────── */}
          <section>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('booking.admin.customerPhone' as never)}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={phoneQuery}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="09XXXXXXXXX"
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {customerMatch && !guestMode && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-green-600" />
                <span className="font-semibold text-green-800">{customerMatch.username}</span>
                <span className="ml-auto text-xs text-green-600">
                  {t('booking.admin.linkedAccount' as never)}
                </span>
              </div>
            )}

            {noMatch && !guestMode && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-gray-500">{t('booking.admin.noAccountFound' as never)}</p>
                <button
                  onClick={() => { setGuestMode(true); setGuestPhone(phoneQuery) }}
                  className="text-xs font-semibold text-primary underline underline-offset-2"
                >
                  {t('booking.admin.bookAsGuest' as never)}
                </button>
              </div>
            )}

            {guestMode && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700">
                    {t('booking.admin.guestBooking' as never)}
                  </span>
                  <button
                    onClick={() => { setGuestMode(false); setGuestName(''); setGuestPhone('') }}
                    className="text-xs text-gray-500 underline"
                  >
                    {t('booking.admin.switchToLinked' as never)}
                  </button>
                </div>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={t('booking.admin.guestName' as never)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder={t('booking.admin.guestPhone' as never)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </section>

          {/* ── Section 2: Date & Slots ─────────────── */}
          <section>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('booking.admin.pickDate' as never)}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <label className="mb-1.5 mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('booking.admin.pickSlots' as never)}
            </label>

            {loadingSlots ? (
              <div className="grid animate-pulse grid-cols-4 gap-1.5">
                {dayHours().map((h) => (
                  <div key={h} className="h-12 rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : slotData ? (
              <div className="grid grid-cols-4 gap-1.5">
                {slotData.map((slot) => (
                  <button
                    key={slot.hour}
                    type="button"
                    onClick={() => handleSlotClick(slot.hour, slot.state)}
                    disabled={slot.state === 'booked' || slot.state === 'closed'}
                    className={`flex flex-col items-center rounded-lg border px-1 py-1.5 text-center transition-colors ${slotTileClass(slot)}`}
                  >
                    <span className="text-[11px] font-bold leading-tight">
                      {pad(slot.hour)}:00
                    </span>
                    <span className="text-[9px] opacity-70">
                      {(slot.price / 1000).toFixed(0)}k
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Select a date to load slots.</p>
            )}

            {maxSlotsError && (
              <p className="mt-1.5 text-xs text-red-500">
                {t('booking.admin.maxSlotsReached' as never)}
              </p>
            )}

            {hasPendingConflict && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>{t('booking.admin.slotPendingWarning' as never)}</span>
              </div>
            )}
          </section>

          {/* ── Section 3: Details ──────────────────── */}
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t('booking.admin.depositAmount' as never)}
                </label>
                <input
                  type="number"
                  value={depositTotal}
                  min={0}
                  max={500000}
                  onChange={(e) => setDepositTotal(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t('booking.admin.sourceLabel' as never)}
                </label>
                <div className="flex gap-1">
                  {(['phone', 'walk_in', 'other'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={`flex-1 rounded-lg border py-1.5 text-[10px] font-semibold transition-colors ${
                        source === s
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {s === 'phone'
                        ? t('booking.admin.sourcePhone' as never)
                        : s === 'walk_in'
                          ? t('booking.admin.sourceWalkIn' as never)
                          : t('booking.admin.sourceOther' as never)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Deposit received toggle */}
            <button
              type="button"
              onClick={() => setDepositReceived((v) => !v)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 transition-colors ${
                depositReceived
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              <span className="text-sm font-semibold">
                {depositReceived
                  ? t('booking.admin.depositReceivedLabel' as never)
                  : t('booking.admin.depositPending' as never)}
              </span>
              <div
                className={`relative h-5 w-9 rounded-full transition-colors ${depositReceived ? 'bg-green-500' : 'bg-gray-200'}`}
              >
                <span
                  className={`absolute top-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${depositReceived ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </div>
            </button>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t('booking.admin.notesLabel' as never)}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={t('booking.admin.notesPlaceholder' as never)}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </section>

          {/* Error */}
          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{submitError}</p>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? <Spinner /> : <Plus className="h-4 w-4" />}
            {t('booking.admin.createBooking' as never)}
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in the new component.

- [ ] **Step 3: Commit**

```bash
git add components/admin/booking/AdminNewBookingPanel.tsx
git commit -m "feat(ui): add AdminNewBookingPanel slide-in booking form"
```

---

## Task 7: AdminBookingsList Updates

**Files:**
- Modify: `components/admin/booking/AdminBookingsList.tsx`

This task has multiple sub-changes. Apply them in order.

- [ ] **Step 1: Extend the `AdminBooking` type**

In `AdminBookingsList.tsx`, replace the existing `AdminBooking` type (lines 13–24):

```ts
export type AdminBooking = {
  id: string
  ref: string
  status: BookingStatus
  booking_date: string
  deposit_total: number
  deposit_received: boolean
  override_request: boolean
  updated_at: string
  customer: { username: string | null; phone: string | null } | null
  hours: number[]
  source: 'online' | 'phone' | 'walk_in' | 'other' | null
  guest_name: string | null
  guest_phone: string | null
  internal_notes: string | null
}
```

- [ ] **Step 2: Update `SELECT_QUERY`**

Replace:
```ts
const SELECT_QUERY =
  'id, ref, status, booking_date, deposit_total, deposit_received, override_request, updated_at, customer:profiles(username, phone), booking_slots(hour_start)'
```
With:
```ts
const SELECT_QUERY =
  'id, ref, status, booking_date, deposit_total, deposit_received, override_request, updated_at, source, guest_name, guest_phone, internal_notes, customer:profiles(username, phone), booking_slots(hour_start)'
```

- [ ] **Step 3: Update `parseRow` to include new fields**

Replace the `return` statement inside `parseRow` (starting at `return {`):

```ts
  return {
    id: b.id as string,
    ref: b.ref as string,
    status: b.status as AdminBooking['status'],
    booking_date: b.booking_date as string,
    deposit_total: (b.deposit_total as number) ?? 0,
    deposit_received: (b.deposit_received as boolean) ?? false,
    override_request: (b.override_request as boolean) ?? false,
    updated_at: (b.updated_at as string) ?? new Date(0).toISOString(),
    customer: customer
      ? { username: customer.username as string | null, phone: customer.phone as string | null }
      : null,
    hours: ((b.booking_slots as { hour_start: number }[]) ?? []).map((s) => s.hour_start),
    source: (b.source as AdminBooking['source']) ?? null,
    guest_name: (b.guest_name as string | null) ?? null,
    guest_phone: (b.guest_phone as string | null) ?? null,
    internal_notes: (b.internal_notes as string | null) ?? null,
  }
```

- [ ] **Step 4: Add source badge styles constant and notes expand state**

After the `statusKey` constant (around line 72), add:

```ts
const sourceStyle: Record<NonNullable<AdminBooking['source']>, string> = {
  online: 'bg-blue-100 text-blue-700',
  phone: 'bg-purple-100 text-purple-700',
  walk_in: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
}

const sourceLabel: Record<NonNullable<AdminBooking['source']>, string> = {
  online: 'Online',
  phone: 'Phone',
  walk_in: 'Walk-in',
  other: 'Other',
}
```

- [ ] **Step 5: Add `isPanelOpen`, `successMsg`, `expandedNotes` state**

Inside the `AdminBookingsList` component function, after the existing state declarations (after `const [cancelConfirmId, ...]`), add:

```ts
const [isPanelOpen, setIsPanelOpen] = useState(false)
const [successMsg, setSuccessMsg] = useState<string | null>(null)
const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

function toggleNotes(id: string) {
  setExpandedNotes((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
}

function handleBookingCreated(ref: string, hadConflict: boolean) {
  const msg = hadConflict
    ? `Booking ${ref} created — pending conflict, confirm from list to resolve.`
    : `Booking ${ref} created.`
  setSuccessMsg(msg)
  setTimeout(() => setSuccessMsg(null), 5000)
}
```

- [ ] **Step 6: Add the "+ New Booking" button and success banner**

In the JSX, replace the opening of the `return` block — specifically the `<div className="space-y-4">` that wraps everything. Add the panel trigger and success banner right after `<div className="space-y-4">`:

After the `<div className="space-y-4">` opening tag, add:

```tsx
      {/* New Booking button row */}
      <div className="flex items-center justify-between">
        <span />
        <button
          onClick={() => setIsPanelOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          {t('booking.admin.newBooking' as never)}
        </button>
      </div>

      {successMsg && (
        <div className="rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800">
          {successMsg}
        </div>
      )}
```

- [ ] **Step 7: Add `AdminNewBookingPanel` mount at the bottom of the JSX**

Just before the closing `</div>` of the component return, add:

```tsx
      <AdminNewBookingPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onSuccess={handleBookingCreated}
      />
```

- [ ] **Step 8: Add `Plus` to the lucide-react import and import `AdminNewBookingPanel`**

At the top of the file, update the lucide import to include `Plus`:
```ts
import { Check, X, Phone, Clock, AlertTriangle, Search, ChevronLeft, ChevronRight, Plus, ChevronDown } from 'lucide-react'
```

Add import for the panel:
```ts
import AdminNewBookingPanel from './AdminNewBookingPanel'
```

- [ ] **Step 9: Update customer display in desktop table to use guest fields**

In the desktop table `<tbody>`, inside the customer `<td>`, replace the name/phone display:

Replace:
```tsx
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {b.customer?.username ?? '—'}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {b.customer?.phone ?? '—'}
                            </p>
                          </div>
```
With:
```tsx
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {b.customer?.username ?? b.guest_name ?? 'Guest'}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {b.customer?.phone ?? b.guest_phone ?? '—'}
                            </p>
                          </div>
```

Also update the initials derivation (replace the existing `const name = b.customer?.username ?? ''`):
```tsx
                  const displayName = b.customer?.username ?? b.guest_name ?? 'Guest'
                  const initials = displayName.substring(0, 2).toUpperCase()
```
And update the avatar color call and usage to use `displayName` instead of `name`.

- [ ] **Step 10: Add source badge to desktop status column**

In the desktop `<td>` for status (the one with `statusStyle`), after the existing `override_request` badge, add:

```tsx
                          {b.source && b.source !== null && (
                            <span
                              className={`inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${sourceStyle[b.source]}`}
                            >
                              {sourceLabel[b.source]}
                            </span>
                          )}
```

- [ ] **Step 11: Add notes expand to desktop table — actions column**

In the desktop actions `<td>`, after the cancel button block, add:

```tsx
                          {b.internal_notes && (
                            <button
                              onClick={() => toggleNotes(b.id)}
                              title="Internal notes"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50"
                            >
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${expandedNotes.has(b.id) ? 'rotate-180' : ''}`}
                              />
                            </button>
                          )}
```

After the `<tr>` for each row, add an expanded notes row:

```tsx
                    {expandedNotes.has(b.id) && b.internal_notes && (
                      <tr key={`${b.id}-notes`}>
                        <td colSpan={6} className="bg-gray-50 px-4 pb-3 pt-0">
                          <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                            {b.internal_notes}
                          </p>
                        </td>
                      </tr>
                    )}
```

- [ ] **Step 12: Update mobile cards to use guest name + source badge + notes**

In the mobile cards, update the name/phone display:

Replace:
```tsx
                    <p className="truncate font-semibold text-gray-900">
                      {b.customer?.username ?? 'Unknown'}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-gray-400">
                      <Phone className="h-3 w-3" /> {b.customer?.phone ?? '—'}
                    </p>
```
With:
```tsx
                    <p className="truncate font-semibold text-gray-900">
                      {b.customer?.username ?? b.guest_name ?? 'Guest'}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-gray-400">
                      <Phone className="h-3 w-3" />{' '}
                      {b.customer?.phone ?? b.guest_phone ?? '—'}
                    </p>
```

In the mobile card status area (after the status span in the top-right cluster), add source badge:
```tsx
                    {b.source && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sourceStyle[b.source]}`}>
                        {sourceLabel[b.source]}
                      </span>
                    )}
```

At the bottom of each mobile card (before the closing `</div>` of the card), add notes expand:
```tsx
                  {b.internal_notes && (
                    <div className="mt-2 border-t border-gray-100 pt-2">
                      <button
                        onClick={() => toggleNotes(b.id)}
                        className="flex items-center gap-1 text-xs text-gray-400"
                      >
                        <ChevronDown
                          className={`h-3 w-3 transition-transform ${expandedNotes.has(b.id) ? 'rotate-180' : ''}`}
                        />
                        {t('booking.admin.internalNotes' as never)}
                      </button>
                      {expandedNotes.has(b.id) && (
                        <p className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          {b.internal_notes}
                        </p>
                      )}
                    </div>
                  )}
```

- [ ] **Step 13: Verify TypeScript compiles and tests pass**

```bash
npx tsc --noEmit
npm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 14: Commit**

```bash
git add components/admin/booking/AdminBookingsList.tsx
git commit -m "feat(ui): extend AdminBookingsList with source badge, guest display, notes, New Booking button"
```

---

## Task 8: Admin Bookings Page Updates

**Files:**
- Modify: `app/(admin)/admin/bookings/page.tsx`

- [ ] **Step 1: Update SELECT cols in `runQuery`**

In `page.tsx`, find the `cols` strings inside `runQuery` (lines 94–97). Replace both:

```ts
    const cols = includeOverride
      ? 'id, ref, status, booking_date, deposit_total, deposit_received, override_request, updated_at, source, guest_name, guest_phone, internal_notes, customer:profiles(username, phone), booking_slots(hour_start)'
      : 'id, ref, status, booking_date, deposit_total, deposit_received, updated_at, source, guest_name, guest_phone, internal_notes, customer:profiles(username, phone), booking_slots(hour_start)'
```

- [ ] **Step 2: Update the row mapping to include new fields**

In the `list = rows.map((b) => { ... })` block, add the four new fields to the return object:

```ts
        source: (b.source as AdminBooking['source']) ?? null,
        guest_name: (b.guest_name as string | null) ?? null,
        guest_phone: (b.guest_phone as string | null) ?? null,
        internal_notes: (b.internal_notes as string | null) ?? null,
```

The full return block becomes:

```ts
      return {
        id: b.id as string,
        ref: b.ref as string,
        status: b.status as AdminBooking['status'],
        booking_date: b.booking_date as string,
        deposit_total: (b.deposit_total as number) ?? 0,
        deposit_received: (b.deposit_received as boolean) ?? false,
        override_request: (b.override_request as boolean) ?? false,
        customer: customer
          ? {
              username: customer.username as string | null,
              phone: customer.phone as string | null,
            }
          : null,
        hours: ((b.booking_slots as { hour_start: number }[]) ?? []).map((s) => s.hour_start),
        updated_at: (b.updated_at as string) ?? new Date(0).toISOString(),
        source: (b.source as AdminBooking['source']) ?? null,
        guest_name: (b.guest_name as string | null) ?? null,
        guest_phone: (b.guest_phone as string | null) ?? null,
        internal_notes: (b.internal_notes as string | null) ?? null,
      }
```

- [ ] **Step 3: Final TypeScript + test check**

```bash
npx tsc --noEmit
npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/admin/bookings/page.tsx"
git commit -m "feat(admin): update bookings page to select and map new booking fields"
```

---

## Task 9: Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the New Booking panel opens**

Navigate to `http://localhost:3000/admin/bookings`. Log in as admin or superadmin. Verify:
- "+ New Booking" button visible in top-right of the page
- Clicking it opens the panel (bottom sheet on mobile, side drawer on ≥768px)
- X button and backdrop tap close the panel

- [ ] **Step 3: Test customer search**

In the panel, type a phone number of an existing customer. Verify:
- After 400ms debounce, a green "Linked to account" badge appears with the customer name
- Typing a non-existent phone shows "No account found" + "Book as guest" button
- Clicking "Book as guest" shows guest name + phone inputs

- [ ] **Step 4: Test slot grid**

Select today's date (or any date). Verify:
- Slot grid shows 16 tiles (06:00–21:00)
- Available slots have white background, pending slots amber, booked/closed gray
- Clicking available slot selects it (turns primary color)
- Clicking again deselects
- Trying to select a 3rd slot shows "Maximum 2 slots" error
- Selecting a pending slot shows the amber warning strip

- [ ] **Step 5: Test form submission (phone + pending deposit)**

Fill in: phone-linked customer, a date with an available slot, 1 slot selected, deposit 10000, pending payment, source = Phone. Click "Create Booking". Verify:
- Loading spinner on button
- Panel closes on success
- Green success banner appears above the bookings list: "Booking MYF-XXXX-XXXX created."
- New booking row appears in list immediately (realtime INSERT handler)
- Source badge shows purple "Phone"

- [ ] **Step 6: Test guest booking**

Open panel again. Enter a non-existent phone, click "Book as guest", fill in guest name. Select date + slot, submit. Verify:
- New row shows guest name where customer name would normally appear
- No linked account phone visible

- [ ] **Step 7: Test internal notes expand**

Create a booking with notes filled in. Verify:
- Chevron button visible in Actions column (desktop) or at bottom of mobile card
- Clicking it expands an inset notes block
- Clicking again collapses it

- [ ] **Step 8: Test confirmed booking creation**

Create a booking with "Deposit received" toggled ON. Verify:
- New row appears in list with `confirmed` status
- Deposit received toggle is already ON

- [ ] **Step 9: Commit all if everything works**

If any visual polish is needed, fix and commit. Final state commit:

```bash
git add -A
git commit -m "feat: admin manual booking entry complete"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| + New Booking button on `/admin/bookings` | Task 7 step 6 |
| Slide-in panel desktop / bottom sheet mobile | Task 6 |
| Phone search → linked account | Task 6 |
| Guest mode (name + phone) | Task 6 |
| Date picker + slot grid | Task 6 |
| Pending slot amber warning | Task 6 |
| Deposit amount + payment toggle | Task 6 |
| Source pills (Phone/Walk-in/Other) | Task 6 |
| Internal notes textarea | Task 6 |
| DB: customer_id nullable | Task 1 |
| DB: source, guest_name, guest_phone, internal_notes | Task 1 |
| DB: create_admin_booking_transaction RPC | Task 1 |
| POST /api/admin/bookings | Task 5 |
| GET /api/admin/slot-availability | Task 4 |
| AdminBookingsList: source badge | Task 7 step 10 |
| AdminBookingsList: guest name display | Task 7 step 9 |
| AdminBookingsList: notes expand | Task 7 step 11–12 |
| After creation: success toast + realtime update | Task 7 step 5–6 |
| i18n keys | Task 3 |
| Zod schema | Task 2 |
| Unit tests for auth guards | Tasks 4+5 step 3 |
| Unit tests for validation | Task 5 step 4 |

All spec sections covered. No gaps found.
