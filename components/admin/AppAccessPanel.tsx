'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { APPS, APP_NAMES, type AppName, type AppRole } from '@/lib/apps'

/**
 * Which businesses this person may enter, and at what rank.
 *
 * This replaces hand-written SQL. Granting used to mean two inserts in two
 * schemas - the grant itself, and a row in that business's own staff
 * directory - and missing the second let someone in who then hit a foreign
 * key error the moment they recorded anything. grant_app_access() does both
 * in one transaction, so that half-state is no longer reachable.
 *
 * The panel shows what is true, not what this admin may change: a business
 * they cannot manage still renders, disabled. Hiding it would leave them
 * wondering whether the person has access at all.
 */
export default function AppAccessPanel({
  userId,
  username,
  grants,
  manageable,
}: {
  userId: string
  username: string
  /** Current rank per business; absent means no access. */
  grants: Partial<Record<AppName, AppRole>>
  /** Businesses the signed-in admin is allowed to change. */
  manageable: AppName[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<AppName | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(method: 'POST' | 'DELETE', app: AppName, role?: AppRole) {
    setBusy(app)
    setError(null)
    try {
      const res = await fetch('/api/admin/access', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, app, role }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? 'Could not update access.')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="mb-1">
        <h2 className="font-semibold text-gray-900 text-sm">Business access</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Which systems {username} can sign in to, and their rank in each.
        </p>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[12.5px] text-red-800">
          <TriangleAlert className="w-4 h-4 mt-px flex-none" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {APP_NAMES.map((app) => {
          const current = grants[app]
          const canManage = manageable.includes(app)
          const working = busy === app || (pending && busy === app)

          return (
            <div
              key={app}
              className="flex items-center gap-3 rounded-xl border border-gray-100 px-3.5 py-3"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-none"
                style={{ background: current ? APPS[app].accent : '#d4d7dd' }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 capitalize">{app}</div>
                <div className="text-[11.5px] text-gray-500">
                  {current ? `Has access · ${current}` : 'No access'}
                </div>
              </div>

              {working ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : canManage ? (
                <div className="flex items-center gap-2">
                  <select
                    value={current ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') send('DELETE', app)
                      else send('POST', app, v as AppRole)
                    }}
                    className="text-[12.5px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                    aria-label={`Access to ${app}`}
                  >
                    <option value="">No access</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                  {current && <Check className="w-4 h-4 text-green-600" />}
                </div>
              ) : (
                <span className="text-[11.5px] text-gray-400">Not yours to change</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        Removing access keeps the person&apos;s recorded history intact — their past sessions
        stay attached to their name, they simply can no longer sign in to that system.
      </p>
    </div>
  )
}
