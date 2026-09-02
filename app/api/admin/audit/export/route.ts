import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireAnyAdmin } from '@/lib/auth'
import { getMyApps } from '@/lib/apps.server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAppName } from '@/lib/apps'
import { formatDateTime } from '@/lib/utils'
import { serverError } from '@/lib/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE = 1000
const RANGES = [7, 30, 90] as const

/**
 * The audit log, as a spreadsheet.
 *
 * Separate from /api/admin/export rather than another sheet in the backup, for
 * two reasons that are not stylistic:
 *
 *   - The backup runs on the service role, which bypasses RLS. Putting the
 *     audit log in there would hand a billiards-only superadmin every futsal
 *     and game row in the file, silently. This route reads with the SIGNED-IN
 *     client so the same select policy that scopes the page scopes the export.
 *
 *   - It exports what is on screen. An audit export exists to be handed to
 *     someone in an argument, and "here is the log, filtered to what I was
 *     looking at" is the useful artefact.
 */
export async function GET(req: Request) {
  let actorId: string
  try {
    actorId = (await requireAnyAdmin()).id
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    return NextResponse.json(
      { error: msg === 'FORBIDDEN' ? 'Forbidden' : 'Unauthorized' },
      { status: msg === 'FORBIDDEN' ? 403 : 401 }
    )
  }

  const apps = await getMyApps()
  const me = (apps ?? []).filter((a) => a.role === 'superadmin')
  if (me.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const appParam = url.searchParams.get('app')
  const appFilter = appParam && isAppName(appParam) ? appParam : null
  const daysRaw = Number(url.searchParams.get('days'))
  const days = (RANGES as readonly number[]).includes(daysRaw) ? daysRaw : 30
  const actor = url.searchParams.get('actor')?.trim() || null
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    const supabase = await createClient()

    const rows: Record<string, unknown>[] = []
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('audit_log')
        .select('created_at, app, action, actor_name, target_type, target_label, summary, details')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (appFilter) q = q.eq('app', appFilter)
      if (actor) q = q.eq('actor_id', actor)

      const { data, error } = await q
      if (error) throw new Error(error.message)
      const page = (data as Record<string, unknown>[]) ?? []
      rows.push(...page)
      if (page.length < PAGE) break
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'MyaThida Admin'
    workbook.created = new Date()

    const readme = workbook.addWorksheet('README')
    const ws = workbook.addWorksheet('Audit Log')
    ws.columns = [
      { header: 'When (Myanmar)', key: 'when', width: 26 },
      { header: 'Business', key: 'app', width: 12 },
      { header: 'Who', key: 'who', width: 18 },
      { header: 'What happened', key: 'summary', width: 70 },
      { header: 'Action code', key: 'action', width: 20 },
      { header: 'Target type', key: 'target_type', width: 14 },
      { header: 'Target', key: 'target_label', width: 24 },
      { header: 'Details', key: 'details', width: 50 },
    ]
    ws.getRow(1).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    for (const r of rows) {
      ws.addRow([
        formatDateTime(String(r.created_at)),
        r.app ?? null,
        r.actor_name ?? null,
        // The frozen English sentence written at the time, not a re-render.
        // If the wording ever changes in the app, this file still says what
        // the database recorded, which is the point of exporting it.
        r.summary ?? null,
        r.action ?? null,
        r.target_type ?? null,
        r.target_label ?? null,
        r.details ? JSON.stringify(r.details) : null,
      ])
    }

    readme.columns = [
      { header: 'Field', key: 'field', width: 26 },
      { header: 'Value', key: 'value', width: 70 },
    ]
    readme.getRow(1).font = { bold: true }
    const nowIso = new Date().toISOString()
    readme.addRow(['Export', 'MyaThida — audit log'])
    readme.addRow(['Generated at (Myanmar)', formatDateTime(nowIso)])
    readme.addRow(['Generated at (UTC ISO)', nowIso])
    readme.addRow(['Business filter', appFilter ?? 'All businesses I can see'])
    readme.addRow(['Period', `Last ${days} days`])
    readme.addRow(['Actor filter', actor ?? 'Everyone'])
    readme.addRow(['Rows', rows.length])
    readme.addRow(['', ''])
    readme.addRow([
      'Scope note',
      'This file contains only the businesses the person who exported it is a superadmin of. It is not necessarily the whole log.',
    ])
    readme.addRow([
      'Integrity note',
      'audit_log is append-only: it has no insert, update or delete policy, so no account can add to or edit it through the app. Rows are written only by database functions.',
    ])

    const buffer = await workbook.xlsx.writeBuffer()
    const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yangon' }).format(new Date())
    const filename = `myathida-audit-${appFilter ?? 'all'}-${stamp}.xlsx`

    // Recorded AFTER the file is built, never before: an export that failed
    // halfway must not leave a row claiming the data left the building.
    //
    // Written with the service client because audit() is deliberately not
    // granted to `authenticated` - a signed-in session must not be able to
    // write its own history. The actor is passed explicitly since the service
    // role has no auth.uid().
    try {
      const svc = await createServiceClient()
      await svc.rpc('audit', {
        p_app: appFilter ?? me[0].app,
        p_action: 'export.generated',
        p_summary: `Exported the audit log (${appFilter ?? 'all businesses'}, last ${days} days, ${rows.length} rows).`,
        p_target_type: 'export',
        p_target_id: null,
        p_target_label: filename,
        p_details: { app: appFilter, days, rows: rows.length, actor },
        p_actor: actorId,
      })
    } catch (e) {
      // The file is already built and about to be sent. Failing the download
      // now would be worse than a missing log line, and unlike the trigger
      // paths there is nothing to roll back.
      console.error('[audit export] could not record the export', e)
    }

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return serverError(error instanceof Error ? error.message : 'audit export failed')
  }
}
