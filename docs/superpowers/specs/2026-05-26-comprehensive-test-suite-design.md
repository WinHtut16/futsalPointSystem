# Comprehensive Test Suite — Design Spec
**Date:** 2026-05-26  
**Scope:** Gap-fill unit + E2E tests for pre-production robustness  
**Baseline:** 204 unit tests, 10 files, 5 E2E journeys — all passing  

---

## 1. Context

The codebase already has strong coverage in:
- **Privilege escalation** — every protected route rejects under-privileged callers (29 tests)
- **Input validation + injection** — every route rejects malformed/injected input (106 tests)
- **Business logic** — redeem, approve, reject, concurrent race conditions (35 tests)
- **IDOR guards** — cross-role object access blocked (8 tests)
- **Middleware** — route-guard redirects for all role combinations (9 tests)

Coverage gaps identified by gap analysis:

| Area | Gap |
|------|-----|
| `/api/points/adjust` | Zero coverage — validation, privilege, business logic all missing |
| Customer mgmt success paths | GET list, GET/[id], PUT (password + profile update), DELETE |
| Registration | Success path + duplicate phone rejection |
| Redemption cancel | Customer CANCEL action, ownership check |
| Mass assignment | `role` and `total_points` blocked via profile update PUT |
| Edge case | Approve when customer no longer exists |
| DB-level (E2E only) | `created_at` stored on signup, transaction records correct, `resolved_at` set on approve, period filter accuracy, cascade on customer delete |

---

## 2. Approach

**Option A — Gap-fill only (chosen)**

3 new unit test files + 1 new E2E journey file. No existing files modified. All new tests follow conventions already established in the codebase.

**Conventions to follow:**
- Unit tests: `__tests__/*.test.ts`, run with Vitest, no real DB, `vi.mock('@/lib/auth')` + `vi.mock('@/lib/supabase/server')` for isolation
- Supabase mock pattern: queue-based FIFO (`queryQueue`) for `.single()` / `.maybySingle()` terminal calls; `mockRpc` for RPC calls
- Auth mock pattern: mutable `authState` object mutated by `asAdmin()` / `asCustomer()` / `asSuperAdmin()` helpers
- After-each assert: `createServiceClient` not called in privilege tests; `mockRpc` not called in rejection branches
- E2E tests: `e2e/journey-N.spec.ts`, Playwright, real Supabase via `.env.e2e`, uses `e2e/helpers/auth.ts`

---

## 3. Unit Test Files

### 3.1 `__tests__/api-adjust-points.test.ts`

**Covers:** `POST /api/points/adjust`

#### Privilege block
- Unauthenticated → 401/403
- Customer caller → 401/403
- *(afterEach asserts Supabase never reached)*

#### Validation block (Supabase mock throws if reached)
- Missing `customer_id` → 400
- Non-uuid `customer_id` → 400
- SQL injection in `customer_id` → 400
- Zero `points_delta` → 400
- `points_delta` > 10,000 → 400
- `points_delta` < −10,000 → 400
- Missing `reason` → 400
- Empty `reason` → 400
- `reason` > 500 chars → 400

#### Business logic block
Setup: `asAdmin()`, queue-based mock + `mockRpc`

| Test | Queue setup | Assertion |
|------|-------------|-----------|
| Positive adjustment (+50) | `{id, role:'customer', total_points:100}` → RPC ok → `{total_points:150}` | 200, `points_delta:50, total_points:150` |
| Negative adjustment (−30) | `{total_points:100}` → RPC ok → `{total_points:70}` | 200, `points_delta:-30` |
| Exact-zero result (−100 when balance=100) | `{total_points:100}` → RPC ok → `{total_points:0}` | 200, `total_points:0` |
| Balance-goes-negative blocked | `{total_points:100}`, `points_delta:-101` | 400; `mockRpc` not called |
| Non-existent customer | queue `{data:null}` | 404; `mockRpc` not called |
| Non-customer target (`role:'admin'`) | queue `{role:'admin'}` | 404; `mockRpc` not called |

---

### 3.2 `__tests__/api-customer-mgmt.test.ts`

**Covers:** success paths for customer-facing CRUD + register

Mock setup: same queue pattern; add `mockAuthAdmin = { updateUserById, deleteUser }` on the service client mock (matches `api-idor.test.ts` pattern).

#### POST /api/auth/register
Route call order:
1. `from('profiles').select('id').eq('phone').maybySingle()` — existing check
2. `auth.admin.createUser(...)` — create user in Supabase auth

- Valid body: queue `{data:null}` (no existing), `createUser` returns no error → 200 `{success:true}`
- Duplicate phone (app-level check): queue `{data:{id:'existing-id'}}` → 409 `{error:'This phone number is already registered.'}`; assert `createUser` NOT called
- Duplicate phone (auth-level fallback): queue `{data:null}`, `createUser` returns `{error:{message:'already exists'}}` → 409

#### GET /api/customers
- No `?phone` filter → returns array of customer rows, 200
- `?phone=0912345678` → returns filtered results, 200

#### GET /api/customers/[id]
- Found → 200 with profile data
- Not found (`data:null`) → 404

#### PUT /api/customers/[id] — password reset
- Queue `{ role:'customer' }` (IDOR pre-check) → `auth.admin.updateUserById` returns `{}` no error → 200 `{success:true}`
- `updateUserById` returns error → 500

#### PUT /api/customers/[id] — profile update
- Queue `{ role:'customer' }` → DB update succeeds → updated row returned → 200

#### DELETE /api/customers/[id]
- Queue `{ role:'customer' }` → `auth.admin.deleteUser` called once → 200 `{success:true}`
- `deleteUser` returns error → 500

#### Mass assignment — role and total_points blocked
- PUT with `{ role:'superadmin' }` → 400 (strict schema, unknown key)
- PUT with `{ total_points: 9999 }` → 400 (strict schema, unknown key)
- These assert `mockAuthAdmin.updateUserById` not called

---

### 3.3 `__tests__/api-redemption-cancel.test.ts`

**Covers:** Customer CANCEL action + ownership enforcement + approve-when-customer-gone edge case

Mock setup: same queue pattern. Auth flipped between customer and admin.

#### PATCH /api/redemptions/[id] — cancel action (customer)

| Test | Queue / RPC | Assertion |
|------|-------------|-----------|
| Customer cancels own pending request | `{ status:'pending', customer_id: CUSTOMER_ID }` | 200 `{success:true}`; RPC not called |
| Cancel already-resolved request | `{ status:'approved', customer_id: CUSTOMER_ID }` | 400 "Only pending requests can be actioned." |
| Cancel non-existent request | `{data:null}` | 404 |
| Customer cancels another customer's request | `{ status:'pending', customer_id:'OTHER_ID' }` | 403 (ownership check) |

#### Edge case — approve when customer no longer exists
- `asAdmin()`, RPC returns `{ error: { message: 'customer_not_found' } }` (or equivalent DB error)
- Assert response is non-200 (400 or 404 depending on route mapping)

---

## 4. E2E Journey File

### `e2e/journey-6-data-integrity.spec.ts`

**Requires:** `.env.e2e`, running server, real Supabase connection  
**Uses:** `e2e/helpers/auth.ts`, Supabase service client for assertions  

All tests in this file use `test.describe.serial()` — they run in order to avoid parallel conflicts on shared state.

#### A. Registration stores required fields
1. POST to `/api/auth/register` with `E2E_NEW_CUSTOMER_PHONE`
2. Query `profiles` via service client: assert `id`, `phone`, `username`, `role='customer'`, `total_points=0`, `created_at` is non-null and parseable ISO timestamp
3. `afterAll`: delete user

#### B. Duplicate phone rejection
1. Attempt second registration with same phone
2. Assert response status is 4xx (not 201)

#### C. Points issuance creates correct transaction record
1. Login as superadmin via `/admin/login`
2. POST `/api/points/add` for E2E customer (1 hour = 10 pts)
3. Query `point_transactions` for customer: latest row has `transaction_type='earn'`, `points_delta=10`, non-null `created_at`

#### D. Approve records resolved_at timestamp
1. Login as E2E customer, POST `/api/redemptions` for the E2E test reward
2. Login as superadmin, PATCH `/api/redemptions/[id]` with `{action:'approve'}`
3. Query `redemption_requests`: row has `status='approved'`, `resolved_at` is non-null and after `requested_at`

#### E. Dashboard period filter — empty month returns zeros, not error
1. Navigate to `/admin/dashboard?month=1&year=2000`
2. Assert page renders without error (no 500 page, no crash text)
3. Assert period stat cards contain `0` values (New Customers this period = 0)

#### F. Customer delete cascades correctly
1. Create throwaway customer via `/api/auth/register`
2. Add points via `/api/points/add`
3. Submit redemption via `/api/redemptions`
4. DELETE via `/api/customers/[id]`
5. Assert `profiles` row gone from DB
6. Assert `auth.users` row gone (deleteUser cascades in Supabase)
7. Assert `point_transactions` rows for that customer — document behavior: if FK cascade delete, assert gone; if retained, assert and document

---

## 5. Explicitly Out of Scope (with reasoning)

| Item | Reason skipped |
|------|----------------|
| Brute-force / rate limiting on login | Not implemented in this codebase |
| CSRF protection | Next.js App Router uses `SameSite=Lax` session cookies + CORS — no custom CSRF token needed; by design |
| Pending count real-time accuracy | `PendingRedemptionsContext` is a React client hook — not testable in Vitest node environment; covered by E2E journey-1 (customer submits request, admin sees it) |
| Dashboard chart query correctness | Requires full Supabase DB with seeded time-series data beyond current E2E seed scope; partially covered by E2E section E (empty-month returns 0) |
| Session/token expiry | Managed by `@supabase/ssr` library internals; not route logic we own |
| Top Rewards / Top Customers ranking accuracy | Requires multi-row seeded data with known rankings; too complex for scope; document as future E2E |

---

## 6. Success Criteria

- All 204 existing tests continue to pass
- ≥ 30 new unit tests added across 3 files
- ≥ 6 new E2E scenarios added in journey-6
- No test isolation leaks (each test resets `authState`, `queryQueue`, `mockRpc`)
- All new tests follow existing mock/helper patterns exactly

---

## 7. Files to Create

```
__tests__/api-adjust-points.test.ts       (new — ~80 lines)
__tests__/api-customer-mgmt.test.ts       (new — ~150 lines)
__tests__/api-redemption-cancel.test.ts   (new — ~100 lines)
e2e/journey-6-data-integrity.spec.ts      (new — ~180 lines)
```

No existing files modified.
