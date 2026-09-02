'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy } from 'lucide-react'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { APPS, APP_NAMES, type AppName, type AppRole } from '@/lib/apps'

/**
 * Create an admin AND their access, in one screen.
 *
 * These used to be two steps in two places, and the second one was invisible:
 * you created the account here, it worked, and the person then signed in to an
 * empty portal because nobody knew a separate Business access panel existed on
 * their detail page. Worse, billiards had its own create form that wrote no
 * profiles row at all, so its accounts could not sign in anywhere.
 *
 * Hence the rule enforced here and again in Postgres: an account is created
 * WITH at least one business, or it is not created at all.
 *
 * Importing from '@/lib/apps' (not apps.server) is deliberate - that module is
 * constants and types only. Pulling a value from a module that reaches
 * next/headers is what broke the production build once before.
 */

type Selection = Record<AppName, '' | AppRole>

const EMPTY: Selection = { futsal: '', billiards: '', game: '' }

export default function CreateAdminForm() {
  const router = useRouter()
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [access, setAccess] = useState<Selection>(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  // Set once the account exists. The password is only ever in this browser tab -
  // it is never stored anywhere readable - so the panel below is the one and
  // only chance to write it down.
  const [created, setCreated] = useState<{
    username: string
    password: string
    grants: { app: AppName; role: AppRole }[]
    signInUrl: string
  } | null>(null)

  const grants = APP_NAMES.flatMap((app) =>
    access[app] ? [{ app, role: access[app] as AppRole }] : []
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (grants.length === 0) {
      setError(t('admin.accessRequired'))
      return
    }

    setLoading(true)

    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, grants }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('admin.createAdminFailed'))
      setLoading(false)
      return
    }

    setCreated({
      // The server lowercases the username when it builds the sign-in identity,
      // so echo back what it stored rather than what was typed - otherwise the
      // panel could tell someone to sign in as "Kyaw" when the account is "kyaw".
      username: data.username ?? username.toLowerCase(),
      password,
      grants,
      signInUrl: `${window.location.origin}/admin/login`,
    })
    setLoading(false)
    // The staff list is now stale. Refresh it in the background so it is correct
    // when they navigate there, without moving them off these credentials.
    router.refresh()
  }

  function resetForm() {
    setCreated(null)
    setUsername('')
    setPassword('')
    setAccess(EMPTY)
    setError('')
    setCopied(false)
  }

  if (created) {
    const accessLine = created.grants
      .map((g) => `${t(APPS[g.app].titleKey)} (${g.role})`)
      .join(', ')
    const plain = [
      `${t('admin.createdSignInAt')}: ${created.signInUrl}`,
      `${t('admin.createdUsername')}: ${created.username}`,
      `${t('admin.createdPassword')}: ${created.password}`,
      `${t('admin.createdAccess')}: ${accessLine}`,
    ].join('\n')

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-700" />
            <p className="text-sm font-semibold text-green-900">{t('admin.createdTitle')}</p>
          </div>
          <p className="text-xs text-green-700 mt-1">{t('admin.createdHint')}</p>
        </div>

        <dl className="rounded-xl border border-gray-100 divide-y divide-gray-100 text-sm">
          <Detail label={t('admin.createdSignInAt')} value={created.signInUrl} />
          <Detail label={t('admin.createdUsername')} value={created.username} mono />
          <Detail label={t('admin.createdPassword')} value={created.password} mono />
          <Detail label={t('admin.createdAccess')} value={accessLine} />
        </dl>

        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(plain)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            } catch {
              // Clipboard is blocked in some in-app browsers. The details are
              // on screen and selectable, so this is not worth an error state.
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? t('admin.copied') : t('admin.copyDetails')}
        </button>

        <div className="flex items-center gap-3 pt-1">
          <Button type="button" onClick={resetForm}>
            {t('admin.createAnother')}
          </Button>
          <Link href="/admin/staff" className="text-sm text-gray-500 hover:underline">
            {t('admin.createdDone')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="username"
        label={t('admin.usernameLabel')}
        type="text"
        placeholder="e.g. manager, john.doe"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <p className="text-xs text-gray-400 -mt-2">{t('admin.usernameHint')}</p>
      <PasswordInput
        id="password"
        label={t('admin.passwordLabel')}
        placeholder={t('auth.newPasswordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        showStrength
      />

      <fieldset className="rounded-xl border border-gray-100 p-3.5">
        <legend className="px-1 text-sm font-semibold text-gray-900">
          {t('admin.accessTitle')}
        </legend>
        <p className="text-xs text-gray-400 mb-3">{t('admin.accessHint')}</p>

        <div className="space-y-2">
          {APP_NAMES.map((app) => (
            <div key={app} className="flex items-center gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full flex-none"
                style={{ background: access[app] ? APPS[app].accent : '#d4d7dd' }}
                aria-hidden="true"
              />
              <label htmlFor={`access-${app}`} className="flex-1 text-sm text-gray-700">
                {t(APPS[app].titleKey)}
              </label>
              <select
                id={`access-${app}`}
                value={access[app]}
                onChange={(e) =>
                  setAccess((prev) => ({ ...prev, [app]: e.target.value as '' | AppRole }))
                }
                className="text-[12.5px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">{t('admin.accessNone')}</option>
                <option value="admin">{t('admin.accessAdmin')}</option>
                <option value="superadmin">{t('admin.accessSuperadmin')}</option>
              </select>
            </div>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <Button type="submit" loading={loading} disabled={grants.length === 0}>
        {t('admin.createAdminButton')}
      </Button>
    </form>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 px-3.5 py-2.5">
      <dt className="text-[12px] text-gray-500 w-32 flex-none">{label}</dt>
      <dd className={`flex-1 break-all text-gray-900 ${mono ? 'font-mono text-[13px]' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
