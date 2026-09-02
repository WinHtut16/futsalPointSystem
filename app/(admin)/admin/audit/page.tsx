import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAnyAdmin } from '@/lib/auth'
import { getMyApps } from '@/lib/apps.server'
import { createClient } from '@/lib/supabase/server'
import { APPS, APP_NAMES, isAppName, type AppName } from '@/lib/apps'
import type { TranslationKey } from '@/lib/i18n'
import AuditLogList, { type AuditRow } from '@/components/admin/AuditLogList'
import T from '@/components/ui/T'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const RANGES = [7, 30, 90] as const
type Range = (typeof RANGES)[number]

// Spelled out rather than built from the number, so a missing translation is a
// compile error instead of a key that renders as its own name at runtime.
const RANGE_LABEL: Record<Range, TranslationKey> = {
  7: 'audit.days7',
  30: 'audit.days30',
  90: 'audit.days90',
}

/**
 * Who did what, across all three businesses.
 *
 * Read with the SIGNED-IN client, never the service role. The audit_log select
 * policy is `can_manage_app(app)`, so Postgres decides what each superadmin can
 * see - a billiards-only superadmin gets billiards rows and nothing else, and
 * the isolation the client asked for holds without this page re-implementing
 * it. Reaching for the service role here would quietly hand everyone
 * everything.
 *
 * Distinct from /admin/activity, which looks similar and answers a different
 * question: that one is the customer-facing feed of what happened at the venue
 * (bookings, points, redemptions), keyed on the customer. This one is keyed on
 * the admin. Merging them would make both harder to read.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; days?: string; actor?: string; page?: string }>
}) {
  await requireAnyAdmin()

  // Any superadmin, of any business - not just futsal's. Someone who runs the
  // billiards hall and nothing else is a superadmin here too, and RLS scopes
  // what they see. A plain admin has no business on this page at all.
  const apps = await getMyApps()
  const canSee = (apps ?? []).some((a) => a.role === 'superadmin')
  if (!canSee) redirect('/admin/dashboard')

  const sp = await searchParams
  const appFilter: AppName | null = sp.app && isAppName(sp.app) ? sp.app : null
  const days: Range = RANGES.includes(Number(sp.days) as Range) ? (Number(sp.days) as Range) : 30
  const actor = sp.actor?.trim() || null
  const page = Math.max(1, Number(sp.page) || 1)
  const from = (page - 1) * PAGE_SIZE

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = await createClient()
  let q = supabase
    .from('audit_log')
    .select(
      'id, app, action, actor_id, actor_name, target_type, target_id, target_label, summary, details, created_at'
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    // One extra row, purely to know whether a next page exists without a
    // second count query.
    .range(from, from + PAGE_SIZE)

  if (appFilter) q = q.eq('app', appFilter)
  if (actor) q = q.eq('actor_id', actor)

  const { data, error } = await q

  const query: Record<string, string> = {}
  if (appFilter) query.app = appFilter
  if (days !== 30) query.days = String(days)
  if (actor) query.actor = actor

  function href(next: Record<string, string | null>) {
    const merged = { ...query }
    for (const [k, v] of Object.entries(next)) {
      if (v === null) delete merged[k]
      else merged[k] = v
    }
    const qs = new URLSearchParams(merged).toString()
    return `/admin/audit${qs ? `?${qs}` : ''}`
  }

  const all = (data ?? []) as AuditRow[]
  const hasNext = all.length > PAGE_SIZE
  const rows = all.slice(0, PAGE_SIZE)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          <T k="audit.title" />
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <T k="audit.subtitle" />
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href={href({ app: null })} active={!appFilter} labelKey="audit.allBusinesses" />
        {/* Only businesses this person is superadmin of. RLS would return no
            rows for the others anyway, but offering a filter that can only ever
            come back empty reads as a bug. */}
        {APP_NAMES.filter((a) =>
          (apps ?? []).some((g) => g.app === a && g.role === 'superadmin')
        ).map((a) => (
          <FilterChip
            key={a}
            href={href({ app: a })}
            active={appFilter === a}
            labelKey={APPS[a].titleKey}
          />
        ))}
        <span className="w-px h-5 bg-gray-200 mx-1" />
        {RANGES.map((d) => (
          <FilterChip
            key={d}
            href={href({ days: d === 30 ? null : String(d) })}
            active={days === d}
            labelKey={RANGE_LABEL[d]}
          />
        ))}
      </div>

      {/* An error must never render as an empty log. "Nothing happened" and
          "we could not read the record" look identical to a reader and mean
          opposite things, and this is precisely the screen where that
          confusion is expensive. */}
      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          <T k="audit.loadFailed" />
        </div>
      ) : (
        <AuditLogList rows={rows} activeActor={actor} query={query} />
      )}

      {!error && (page > 1 || hasNext) && (
        <div className="flex items-center gap-3">
          {page > 1 && (
            <Link
              href={href({ page: page === 2 ? null : String(page - 1) })}
              className="text-sm text-brand-600 hover:underline"
            >
              <T k="admin.activityPrev" />
            </Link>
          )}
          {hasNext && (
            <Link href={href({ page: String(page + 1) })} className="text-sm text-brand-600 hover:underline">
              <T k="admin.activityNext" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  href,
  active,
  labelKey,
}: {
  href: string
  active: boolean
  labelKey: TranslationKey
}) {
  return (
    <Link
      href={href}
      className={`text-[12.5px] font-medium px-3 py-1.5 rounded-full border ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      <T k={labelKey} />
    </Link>
  )
}
