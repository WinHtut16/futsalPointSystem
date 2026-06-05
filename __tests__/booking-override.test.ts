import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Shared mock setup ---
const mockGetCurrentUser = vi.fn()
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockNeq = vi.fn()
const mockSingle = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser: mockGetCurrentUser }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no closures
  mockFrom.mockReturnValue({
    select: mockSelect.mockReturnValue({
      eq: mockEq.mockReturnValue({ data: [] }),
      in: mockIn.mockReturnValue({ data: [] }),
    }),
    update: mockUpdate.mockReturnValue({
      eq: mockEq.mockReturnValue({ error: null }),
      in: mockIn.mockReturnValue({ error: null }),
    }),
  })
  mockRpc.mockResolvedValue({ data: [{ id: 'uuid-1', ref: 'MYF-2026-0001', status: 'pending', deposit_total: 10000, price_total: 20000 }], error: null })
})

// ─── POST /api/bookings ───────────────────────────────────────────────────────

describe('POST /api/bookings — override_request', () => {
  it('returns 401 when not logged in', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const { POST } = await import('@/app/api/bookings/route')
    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ booking_date: '2027-01-15', slots: [9], override_request: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls create_override_booking_transaction when override_request=true', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'cust-1', username: 'player1', phone: '0912345678', role: 'customer' })
    // No closures
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [] }),
      }),
    }))
    // Active slot exists — a pending booking holds slot 9 on this date.
    // Chain: .select().eq('booking_date').eq('active').in('hour_start')
    mockFrom.mockImplementationOnce(() => {
      const chain: { eq: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn>; select?: ReturnType<typeof vi.fn> } = {
        eq: vi.fn(),
        in: vi.fn().mockResolvedValue({ data: [{ booking_id: 'pend-bk-1', hour_start: 9 }], error: null }),
      }
      chain.eq.mockReturnValue(chain)
      return { select: vi.fn().mockReturnValue(chain) }
    })
    // That booking is pending — .select().in().eq()
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ id: 'pend-bk-1', status: 'pending' }], error: null }),
        }),
      }),
    }))
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'uuid-2', ref: 'MYF-2027-0002', status: 'pending', deposit_total: 10000, price_total: 20000 }],
      error: null,
    })

    const { POST } = await import('@/app/api/bookings/route')
    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ booking_date: '2027-01-15', slots: [9], override_request: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
    expect(mockRpc).toHaveBeenCalledWith('create_override_booking_transaction', expect.objectContaining({
      p_customer_id: 'cust-1',
      p_booking_date: '2027-01-15',
    }))
  })

  it('returns 409 when a confirmed booking already holds the override slot', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'cust-1', username: 'player1', phone: '09123', role: 'customer' })
    // No closures
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
    }))
    // Active slot found — .select().eq('booking_date').eq('active').in('hour_start')
    mockFrom.mockImplementationOnce(() => {
      const chain: { eq: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> } = {
        eq: vi.fn(),
        in: vi.fn().mockResolvedValue({ data: [{ booking_id: 'conf-booking-1', hour_start: 9 }], error: null }),
      }
      chain.eq.mockReturnValue(chain)
      return { select: vi.fn().mockReturnValue(chain) }
    })
    // That booking is confirmed — .select().in().eq()
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ id: 'conf-booking-1', status: 'confirmed' }], error: null }),
        }),
      }),
    }))

    const { POST } = await import('@/app/api/bookings/route')
    const req = new Request('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ booking_date: '2027-01-15', slots: [9], override_request: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(409)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

// ─── PATCH /api/bookings/[id] ─────────────────────────────────────────────────

describe('PATCH /api/bookings/[id] — confirm auto-cancels conflicting pending', () => {
  it('confirms override booking atomically via RPC', async () => {
    // Conflict cancellation + override confirmation now happen inside a single
    // SECURITY DEFINER RPC (confirm_override_booking) to prevent orphaned state
    // if the server crashes between the two steps.
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'admin' })

    const OVERRIDE_BOOKING_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    // Booking fetch — use mockImplementationOnce to avoid default chain (no .single())
    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: OVERRIDE_BOOKING_ID,
              customer_id: 'cust-1',
              status: 'pending',
              deposit_received: false,
              override_request: true,
              booking_date: '2027-01-15',
            },
            error: null,
          }),
        }),
      }),
    }))

    // Atomic RPC handles conflict cancellation + confirmation in one transaction
    mockRpc.mockResolvedValueOnce({ error: null })

    const { PATCH } = await import('@/app/api/bookings/[id]/route')
    const req = new Request(`http://localhost/api/bookings/${OVERRIDE_BOOKING_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'confirm' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req as never, { params: Promise.resolve({ id: OVERRIDE_BOOKING_ID }) })
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('confirm_override_booking', expect.objectContaining({
      p_booking_id: OVERRIDE_BOOKING_ID,
      p_admin_id: 'admin-1',
    }))
  })
})
