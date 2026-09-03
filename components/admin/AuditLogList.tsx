'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n'
import { APPS, type AppName } from '@/lib/apps'
import { formatDateTime } from '@/lib/utils'

export type AuditRow = {
  id: number
  app: AppName
  action: string
  actor_id: string | null
  actor_name: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  summary: string
  details: Record<string, unknown> | null
  created_at: string
}

/**
 * Known actions, and how to say them in either language.
 *
 * Deliberately a lookup rather than a rendered-at-write-time sentence: the
 * Burmese wording will improve, and it should improve for rows already
 * written. The frozen English `summary` on each row is the fallback below,
 * which also covers the case that matters most - a row written by a newer
 * version of the database than this page knows about. An audit entry must
 * never render as blank just because the UI has not caught up.
 */
const ACTION_LABEL: Record<string, TranslationKey> = {
  'access.granted': 'audit.accessGranted',
  'access.changed': 'audit.accessChanged',
  'access.revoked': 'audit.accessRevoked',
  'admin.created': 'audit.adminCreated',
  'points.adjusted': 'audit.pointsAdjusted',
  'redemption.approved': 'audit.redemptionApproved',
  'redemption.rejected': 'audit.redemptionRejected',
  'session.voided': 'audit.sessionVoided',
  'sessions.bulk_deleted': 'audit.sessionsBulkDeleted',
  'catalogue.created': 'audit.catalogueCreated',
  'catalogue.updated': 'audit.catalogueUpdated',
  'catalogue.removed': 'audit.catalogueRemoved',
  'settings.updated': 'audit.settingsUpdated',
  'export.generated': 'audit.exportGenerated',
}

/**
 * The noun for a catalogue row.
 *
 * Prices, products, tables, stations and rewards share three actions rather
 * than getting twelve of their own - the thing that changed is already in
 * target_type, and "added the menu item Coke" reads better than an action code
 * per table. Unknown types fall back to a plain "item", which is what a row
 * written by a newer migration than this page will say.
 */
const TARGET_NOUN: Record<string, TranslationKey> = {
  menu_item: 'audit.nounMenuItem',
  table: 'audit.nounTable',
  product: 'audit.nounProduct',
  station: 'audit.nounStation',
  pricing: 'audit.nounPricing',
  reward: 'audit.nounReward',
}

// Riding the shared success/info/danger/warning tokens (see DESIGN.md) since
// each of these already carries one of those four meanings. The two literals
// that stay are genuinely outside that vocabulary: purple has no semantic
// slot ("a person was created" isn't good/bad/risky), and #6b7280 is a
// neutral informational dot, not a status.
const DOT: Record<string, string> = {
  'access.granted': 'var(--color-success)',
  'access.changed': 'var(--color-info)',
  'access.revoked': 'var(--color-danger)',
  'admin.created': '#8b5cf6',
  'points.adjusted': 'var(--color-info)',
  'redemption.approved': 'var(--color-success)',
  'redemption.rejected': 'var(--color-danger)',
  'session.voided': 'var(--color-warning)',
  'sessions.bulk_deleted': 'var(--color-danger)',
  'catalogue.created': 'var(--color-success)',
  'catalogue.updated': 'var(--color-info)',
  'catalogue.removed': 'var(--color-danger)',
  'settings.updated': 'var(--color-warning)',
  'export.generated': '#6b7280',
}

/**
 * Values a label may interpolate.
 *
 * Everything comes from the row's own `details`, never from a live lookup, for
 * the same reason the names are snapshots: an entry has to still say "-50
 * points" a year later, after the customer, the reward and the admin are all
 * gone. Anything missing renders as an empty string rather than "undefined",
 * because a slightly thin sentence beats a broken one.
 */
function varsFor(row: AuditRow): Record<string, string | number> {
  const d = (row.details ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-US') : '')
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    target: row.target_label ?? row.target_id ?? '',
    delta:
      typeof d.delta === 'number' ? `${d.delta > 0 ? '+' : ''}${d.delta.toLocaleString('en-US')}` : '',
    from: num(d.from_total),
    to: num(d.to_total),
    count: typeof d.count === 'number' ? d.count : '',
    customer: str(d.customer),
    reason: str(d.reason),
    changes: changeList(d),
  }
}

/**
 * "price 5000 -> 6000, name Coke -> Coke 500ml"
 *
 * Rendered from the details rather than read out of `summary`, so a row still
 * reads correctly in Burmese. Entries whose details predate this shape - or
 * carry anything that is not a from/to pair - contribute nothing rather than
 * printing "[object Object]".
 */
function changeList(details: Record<string, unknown>): string {
  const show = (v: unknown) =>
    v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-US') : String(v)
  return Object.entries(details)
    .filter(([, v]) => v !== null && typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object))
    .map(([k, v]) => {
      const pair = v as { from: unknown; to: unknown }
      return `${k} ${show(pair.from)} → ${show(pair.to)}`
    })
    .join(', ')
}

export default function AuditLogList({
  rows,
  activeActor,
  query,
}: {
  rows: AuditRow[]
  /** actor_id currently filtered on, if any. */
  activeActor: string | null
  /** Current filters, so links can preserve them. */
  query: Record<string, string>
}) {
  const { t, lang } = useLanguage()

  function withParam(key: string, value: string | null) {
    const next = { ...query }
    if (value === null) delete next[key]
    else next[key] = value
    delete next.page
    const qs = new URLSearchParams(next).toString()
    return `/admin/audit${qs ? `?${qs}` : ''}`
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">{t('audit.empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {activeActor && rows.length > 0 && (
        <div className="flex items-center gap-2 text-[12.5px] text-gray-600">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1">
            {rows[0].actor_name}
            <Link href={withParam('actor', null)} aria-label={t('audit.clearActor')}>
              <X className="w-3.5 h-3.5 text-gray-500 hover:text-gray-900" />
            </Link>
          </span>
        </div>
      )}

      {rows.map((row) => {
        const labelKey = ACTION_LABEL[row.action]
        const nounKey = row.target_type ? TARGET_NOUN[row.target_type] : undefined
        const vars = { ...varsFor(row), kind: nounKey ? t(nounKey) : t('audit.nounItem') }
        return (
          <div
            key={row.id}
            className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-start gap-3"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-none mt-1.5"
              style={{ background: DOT[row.action] ?? '#9ca3af' }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 leading-snug">
                {/* The actor is a filter, not decoration: "what else did this
                    person do that day" is the question people actually ask of
                    a log, and it needs no dropdown to answer. */}
                <Link
                  href={withParam('actor', row.actor_id ?? '')}
                  className="font-semibold hover:underline"
                >
                  {row.actor_name}
                </Link>{' '}
                {labelKey ? t(labelKey, vars) : row.summary}
              </p>
              <p className="text-[11.5px] text-gray-400 mt-0.5">
                {formatDateTime(row.created_at, lang)}
              </p>
            </div>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-none"
              style={{ background: `${APPS[row.app].accent}18`, color: APPS[row.app].accent }}
            >
              {t(APPS[row.app].titleKey)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
