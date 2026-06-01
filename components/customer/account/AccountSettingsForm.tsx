'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import Modal from '@/components/ui/Modal'

interface Props {
  initialName: string
  initialPhone: string
}

export default function AccountSettingsForm({ initialName, initialPhone }: Props) {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Profile section
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [profileError, setProfileError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // Password section
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  // Danger zone modal
  const [showDelete, setShowDelete] = useState(false)

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
      const body: Record<string, string> = { username: name.trim() }
      if (phone.trim()) body.phone = phone.trim()
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    <div className="mx-auto w-full max-w-lg px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/account"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-black/5"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className={`font-display text-[17px] font-extrabold text-ink-primary ${my}`}>
          {t('settings.title')}
        </h1>
      </div>

      {/* Section 1 — Profile Information */}
      <form onSubmit={saveProfile} className="fb-card mb-4 p-5">
        <h2 className={`mb-4 font-display text-[14px] font-bold text-ink-primary ${my}`}>
          {t('settings.profile')}
        </h2>
        <div className="space-y-3">
          <Input
            id="s-name"
            label={t('settings.displayName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="s-phone"
            label={t('settings.phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09XXXXXXXXX"
          />
        </div>
        {profileError && <p className="mt-2 text-xs text-red-500">{profileError}</p>}
        <button
          type="submit"
          disabled={profileSaving}
          className="mt-4 fb-btn fb-btn-primary w-full justify-center disabled:opacity-50"
        >
          <span className={my}>{t('settings.saveChanges')}</span>
        </button>
      </form>

      {/* Section 2 — Change Password */}
      <form onSubmit={savePassword} className="fb-card mb-4 p-5">
        <h2 className={`mb-4 font-display text-[14px] font-bold text-ink-primary ${my}`}>
          {t('settings.changePassword')}
        </h2>
        <div className="space-y-3">
          <PasswordInput
            id="s-cpwd"
            label={t('settings.currentPassword')}
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            autoComplete="current-password"
          />
          <PasswordInput
            id="s-npwd"
            label={t('settings.newPassword')}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            showStrength
            autoComplete="new-password"
          />
          <PasswordInput
            id="s-cfpwd"
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
          className="mt-4 fb-btn fb-btn-primary w-full justify-center disabled:opacity-50"
        >
          <span className={my}>{t('settings.updatePassword')}</span>
        </button>
      </form>

      {/* Section 3 — Danger Zone */}
      <div className="fb-card p-5">
        <h2 className={`mb-3 font-display text-[14px] font-bold text-ink-primary ${my}`}>
          {t('settings.dangerZone')}
        </h2>
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className={`text-sm text-red-400 underline underline-offset-2 hover:text-red-600 ${my}`}
        >
          {t('settings.deleteAccount')}
        </button>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Are you sure?"
      >
        <p className="mb-4 text-sm text-gray-600">
          This will permanently delete your account and all booking history. This cannot be undone.
        </p>
        <div className="mb-5 rounded-xl bg-gray-50 p-4">
          <p className={`text-sm text-gray-600 ${my}`}>{t('settings.deleteContact')}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowDelete(false)}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setShowDelete(false)}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600"
          >
            Delete My Account
          </button>
        </div>
      </Modal>

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