import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireSuperAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { ExportQuerySchema, serverError, badRequest } from '@/lib/schemas'
import { formatDateTime } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE = 1000
const MY_OFFSET = '+06:30' // Myanmar UTC+6:30 — month/range boundaries are Myanmar-local

type Col = { key: string; header: string; width?: number }
type Filter = { col: string; kind: 'date' | 'ts' } | null

type TableSpec = {
  sheet: string
  table: string
  orderCol: string
  filter: Filter // null = snapshot table, always exported in full
  columns: Col[]
}

// Snapshot tables (profiles, rewards) are NEVER date-filtered — they hold current
// state (live balances, reward catalog) needed to restore data. Ledger/event tables
// are filtered by the chosen scope.
const SPECS: TableSpec[] = [
  {
    sheet: 'Customers',
    table: 'profiles',
    orderCol: 'created_at',
    filter: null,
    columns: [
      { key: 'id', header: 'Customer ID', width: 38 },
      { key: 'username', header: 'Name', width: 22 },
      { key: 'phone', header: 'Phone', width: 16 },
      { key: 'role', header: 'Role', width: 12 },
      { key: 'total_points', header: 'Total Points', width: 14 },
      { key: 'created_at', header: 'Joined At', width: 26 },
      { key: 'updated_at', header: 'Updated At', width: 26 },
    ],
  },
  {
    sheet: 'Rewards',
    table: 'rewards',
    orderCol: 'created_at',
    filter: null,
    columns: [
      { key: 'id', header: 'Reward ID', width: 38 },
      { key: 'name', header: 'Name', width: 24 },
      { key: 'name_my', header: 'Name (MY)', width: 24 },
      { key: 'description', header: 'Description', width: 30 },
      { key: 'description_my', header: 'Description (MY)', width: 30 },
      { key: 'points_cost', header: 'Points Cost', width: 14 },
      { key: 'stock', header: 'Stock', width: 10 },
      { key: 'is_active', header: 'Active', width: 10 },
      { key: 'is_deleted', header: 'Deleted', width: 10 },
      { key: 'created_at', header: 'Created At', width: 26 },
      { key: 'updated_at', header: 'Updated At', width: 26 },
    ],
  },
  {
    sheet: 'Bookings',
    table: 'bookings',
    orderCol: 'booking_date',
    filter: { col: 'booking_date', kind: 'date' },
    columns: [
      { key: 'id', header: 'Booking ID', width: 38 },
      { key: 'ref', header: 'Ref', width: 16 },
      { key: 'customer_id', header: 'Customer ID', width: 38 },
      { key: 'booking_date', header: 'Booking Date', width: 14 },
      { key: 'status', header: 'Status', width: 12 },
      { key: 'deposit_total', header: 'Deposit Total', width: 14 },
      { key: 'price_total', header: 'Price Total', width: 12 },
      { key: 'deposit_received', header: 'Deposit Received', width: 16 },
      { key: 'source', header: 'Source', width: 12 },
      { key: 'guest_name', header: 'Guest Name', width: 20 },
      { key: 'guest_phone', header: 'Guest Phone', width: 16 },
      { key: 'contact_name', header: 'Contact Name', width: 20 },
      { key: 'contact_phone', header: 'Contact Phone', width: 16 },
      { key: 'internal_notes', header: 'Internal Notes', width: 30 },
      { key: 'override_request', header: 'Override Request', width: 16 },
      { key: 'is_archived', header: 'Archived', width: 10 },
      { key: 'cancelled_at', header: 'Cancelled At', width: 26 },
      { key: 'confirmed_at', header: 'Confirmed At', width: 26 },
      { key: 'created_at', header: 'Created At', width: 26 },
      { key: 'updated_at', header: 'Updated At', width: 26 },
    ],
  },
  {
    sheet: 'Booking Slots',
    table: 'booking_slots',
    orderCol: 'booking_date',
    filter: { col: 'booking_date', kind: 'date' },
    columns: [
      { key: 'id', header: 'Slot ID', width: 38 },
      { key: 'booking_id', header: 'Booking ID', width: 38 },
      { key: 'booking_date', header: 'Booking Date', width: 14 },
      { key: 'hour_start', header: 'Hour Start', width: 12 },
      { key: 'tier', header: 'Tier', width: 12 },
      { key: 'price', header: 'Price', width: 10 },
      { key: 'active', header: 'Active', width: 10 },
    ],
  },
  {
    sheet: 'Point Transactions',
    table: 'point_transactions',
    orderCol: 'created_at',
    filter: { col: 'created_at', kind: 'ts' },
    columns: [
      { key: 'id', header: 'Transaction ID', width: 38 },
      { key: 'customer_id', header: 'Customer ID', width: 38 },
      { key: 'points_delta', header: 'Points Delta', width: 14 },
      { key: 'transaction_type', header: 'Type', width: 14 },
      { key: 'hours_played', header: 'Hours Played', width: 14 },
      { key: 'reward_id', header: 'Reward ID', width: 38 },
      { key: 'note', header: 'Note', width: 30 },
      { key: 'created_by', header: 'Created By', width: 38 },
      { key: 'created_at', header: 'Created At', width: 26 },
    ],
  },
  {
    sheet: 'Redemptions',
    table: 'redemption_requests',
    orderCol: 'requested_at',
    filter: { col: 'requested_at', kind: 'ts' },
    columns: [
      { key: 'id', header: 'Request ID', width: 38 },
      { key: 'customer_id', header: 'Customer ID', width: 38 },
      { key: 'reward_id', header: 'Reward ID', width: 38 },
      { key: 'status', header: 'Status', width: 12 },
      { key: 'points_cost_snapshot', header: 'Points Cost (snapshot)', width: 20 },
      { key: 'requested_at', header: 'Requested At', width: 26 },
      { key: 'resolved_at', header: 'Resolved At', width: 26 },
      { key: 'resolved_by', header: 'Resolved By', width: 38 },
      { key: 'notes', header: 'Notes', width: 30 },
    ],
  },
  {
    sheet: 'Court Closures',
    table: 'court_closures',
    orderCol: 'closure_date',
    filter: { col: 'closure_date', kind: 'date' },
    columns: [
      { key: 'id', header: 'Closure ID', width: 38 },
      { key: 'closure_date', header: 'Closure Date', width: 14 },
      { key: 'hour_start', header: 'Hour Start', width: 12 },
      { key: 'reason', header: 'Reason', width: 30 },
      { key: 'created_by', header: 'Created By', width: 38 },
      { key: 'created_at', header: 'Created At', width: 26 },
    ],
  },
]

type Bounds = { startDate: string; endDate: string } | null // endDate is exclusive

function yangonToday(): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function fetchAll(
  svc: SupabaseClient,
  spec: TableSpec,
  bounds: Bounds
): Promise<Record<string, unknown>[]> {
  const select = spec.columns.map((c) => c.key).join(',')
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    let q = svc.from(spec.table).select(select).order(spec.orderCol, { ascending: true }).range(from, from + PAGE - 1)
    if (bounds && spec.filter) {
      if (spec.filter.kind === 'date') {
        q = q.gte(spec.filter.col, bounds.startDate).lt(spec.filter.col, bounds.endDate)
      } else {
        // timestamptz — anchor boundaries to Myanmar-local midnight
        q = q
          .gte(spec.filter.col, `${bounds.startDate}T00:00:00${MY_OFFSET}`)
          .lt(spec.filter.col, `${bounds.endDate}T00:00:00${MY_OFFSET}`)
      }
    }
    const { data, error } = await q
    if (error) throw new Error(`${spec.table}: ${error.message}`)
    const page = (data as unknown as Record<string, unknown>[]) ?? []
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}

export async function GET(req: Request) {
  try {
    await requireSuperAdmin()
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    return NextResponse.json({ error: msg === 'FORBIDDEN' ? 'Forbidden' : 'Unauthorized' }, { status: msg === 'FORBIDDEN' ? 403 : 401 })
  }

  const url = new URL(req.url)
  const parsed = ExportQuerySchema.safeParse({
    scope: url.searchParams.get('scope') ?? undefined,
    month: url.searchParams.get('month') ?? undefined,
    year: url.searchParams.get('year') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  })
  if (!parsed.success) return badRequest(parsed.error)
  const { scope } = parsed.data

  // Resolve scope → [startDate, endDate) (endDate exclusive) and filename stamp + label
  let bounds: Bounds = null
  let stamp: string
  let scopeLabel: string
  if (scope === 'all') {
    stamp = yangonToday()
    scopeLabel = 'All-time (full backup)'
  } else if (scope === 'month') {
    const year = parsed.data.year!
    const month = parsed.data.month! // 1-12
    const m = String(month).padStart(2, '0')
    const startDate = `${year}-${m}-01`
    // first day of the following month (exclusive end)
    const endDate = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
    bounds = { startDate, endDate }
    stamp = `${year}-${m}`
    scopeLabel = `Month: ${year}-${m}`
  } else {
    const from = parsed.data.from!
    const to = parsed.data.to!
    bounds = { startDate: from, endDate: addDays(to, 1) } // make `to` inclusive
    stamp = `${from}_${to}`
    scopeLabel = `Range: ${from} to ${to}`
  }

  try {
    const svc = createServiceClient()
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'MyaThida Admin'
    workbook.created = new Date()

    // README first so it appears as the first sheet; populated after counts are known
    const readme = workbook.addWorksheet('README')

    const counts: { sheet: string; count: number }[] = []
    for (const spec of SPECS) {
      const ws = workbook.addWorksheet(spec.sheet)
      ws.columns = spec.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }))
      ws.getRow(1).font = { bold: true }
      ws.views = [{ state: 'frozen', ySplit: 1 }]

      const data = await fetchAll(svc, spec, bounds)
      for (const row of data) {
        ws.addRow(spec.columns.map((c) => (row[c.key] ?? null)))
      }
      counts.push({ sheet: spec.sheet, count: data.length })
    }

    // Populate README
    readme.columns = [
      { header: 'Field', key: 'field', width: 26 },
      { header: 'Value', key: 'value', width: 60 },
    ]
    readme.getRow(1).font = { bold: true }
    const nowIso = new Date().toISOString()
    readme.addRow(['Export', 'MyaThida Futsal — data backup'])
    readme.addRow(['Generated at (UTC ISO)', nowIso])
    readme.addRow(['Generated at (Myanmar)', formatDateTime(nowIso)])
    readme.addRow(['Scope', scopeLabel])
    readme.addRow(['', ''])
    readme.addRow(['Sheet', 'Row count'])
    readme.getRow(readme.rowCount).font = { bold: true }
    for (const c of counts) readme.addRow([c.sheet, c.count])
    readme.addRow(['', ''])
    readme.addRow([
      'Note',
      'Customers & Rewards are always exported in full (current state). Point Transactions and Redemptions are the source of truth for point balances. Timestamps are raw ISO (UTC).',
    ])

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `myathida-backup-${scope}-${stamp}.xlsx`
    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'export failed')
  }
}
