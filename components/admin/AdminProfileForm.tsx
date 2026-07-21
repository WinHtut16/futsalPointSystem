'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import InstallAppCard from '@/components/admin/InstallAppCard'

interface Props {
  initialName: string
}

export default function AdminProfileForm({ initialName }: Props) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Profile section
  const [name, setName] = useState(initialName)
  const [profileError, setProfileError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // Password section
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileError('')
    setProfileSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setProfileError((d as { error?: string }).error ?? 'Failed to save')
      } else {
        setToast({ msg: t('settings.profileSaved'), ok: true })
      }
    } catch {
      setProfileError('Network error')
    } finally {
      setProfileSaving(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError('')

    if (!currentPwd || !newPwd || !confirmPwd) return
    if (newPwd.length < 8) { setPwdError(t('settings.passwordTooShort')); return }
    if (newPwd !== confirmPwd) { setPwdError(t('settings.passwordMismatch')); return }

    setPwdSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) { setPwdError('Session expired'); return }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPwd,
      })
      if (signInErr) { setPwdError('Current password is incorrect'); return }

      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) {
        setPwdError(error.message)
      } else {
        setCurrentPwd('')
        setNewPwd('')
        setConfirmPwd('')
        setToast({ msg: t('settings.passwordSaved'), ok: true })
      }
    } catch {
      setPwdError('Network error')
    } finally {
      setPwdSaving(false)
    }
  }

  const mismatch = confirmPwd.length > 0 && newPwd.length > 0 && confirmPwd !== newPwd

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800">My Profile</h1>

      {/* Section 1 — Profile Information */}
      <form onSubmit={saveProfile} className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className={`mb-4 text-sm font-semibold text-gray-700 ${my}`}>
          {t('settings.profile')}
        </h2>
        <Input
          id="ap-name"
          label={t('settings.displayName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {profileError && <p className="mt-2 text-xs text-red-500">{profileError}</p>}
        <button
          type="submit"
          disabled={profileSaving}
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          <span className={my}>{t('settings.saveChanges')}</span>
        </button>
      </form>

      {/* Section 2 — Change Password */}
      <form onSubmit={savePassword} className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className={`mb-4 text-sm font-semibold text-gray-700 ${my}`}>
          {t('settings.changePassword')}
        </h2>
        <div className="space-y-3">
          <PasswordInput
            id="ap-cpwd"
            label={t('settings.currentPassword')}
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            autoComplete="current-password"
          />
          <PasswordInput
            id="ap-npwd"
            label={t('settings.newPassword')}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            showStrength
            autoComplete="new-password"
          />
          <PasswordInput
            id="ap-cfpwd"
            label={t('settings.confirmPassword')}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            error={mismatch ? t('settings.passwordMismatch') : undefined}
            autoComplete="new-password"
          />
        </div>
        {pwdError && <p className="mt-2 text-xs text-red-500">{pwdError}</p>}
        <button
          type="submit"
          disabled={pwdSaving}
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          <span className={my}>{t('settings.updatePassword')}</span>
        </button>
      </form>

      {/* Section 3 — Install App */}
      <InstallAppCard />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg"
          style={{ background: toast.ok ? 'var(--color-primary)' : '#ef4444' }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}