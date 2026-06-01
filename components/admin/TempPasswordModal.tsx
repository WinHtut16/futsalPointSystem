'use client'

import { useState, useCallback } from 'react'
import { Copy, RefreshCw, Check } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  open: boolean
  onClose: () => void
  customerId: string
  customerName: string
  customerPhone: string
}

function generateTempPassword(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const last4 = digits.slice(-4).padStart(4, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `MYF${last4}-${rand}`
}

export default function TempPasswordModal({
  open,
  onClose,
  customerId,
  customerName,
  customerPhone,
}: Props) {
  const { t } = useLanguage()
  const [tempPwd, setTempPwd] = useState(() => generateTempPassword(customerPhone))
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const regenerate = useCallback(() => {
    setTempPwd(generateTempPassword(customerPhone))
    setCopied(false)
  }, [customerPhone])

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(tempPwd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text
    }
  }

  async function handleConfirm() {
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/admin/reset-customer-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: customerId, tempPassword: tempPwd }),
      })
      if (res.ok) {
        setStatus('success')
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMsg((data as { error?: string }).error ?? t('admin.passwordResetFailed'))
        setStatus('error')
      }
    } catch {
      setErrorMsg(t('admin.passwordResetFailed'))
      setStatus('error')
    }
  }

  function handleClose() {
    setStatus('idle')
    setErrorMsg('')
    setCopied(false)
    setTempPwd(generateTempPassword(customerPhone))
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('admin.tempPasswordTitle')}>
      {status === 'success' ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-green-700">{t('admin.tempPasswordSet')}</p>
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-center font-mono text-xl font-bold tracking-widest text-gray-900">
            {tempPwd}
          </div>
          <p className="text-sm text-gray-500">{t('admin.tempPasswordDoneNote')}</p>
          <Button size="lg" onClick={handleClose} className="w-full">
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('admin.tempPasswordBody')}
          </p>
          <p className="text-sm font-medium text-gray-900">
            {customerName} · {customerPhone}
          </p>

          {/* Temp password display */}
          <div className="flex items-center gap-2 rounded-xl border border-line bg-gray-50 px-4 py-3">
            <span className="flex-1 font-mono text-xl font-bold tracking-widest text-gray-900">
              {tempPwd}
            </span>
            <button
              type="button"
              onClick={copyToClipboard}
              title={copied ? 'Copied!' : 'Copy'}
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-gray-500 transition-colors hover:bg-gray-50"
            >
              {copied ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <Copy size={14} />
              )}
              {copied && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-0.5 text-xs text-white">
                  Copied!
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={regenerate}
              title="Regenerate"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-gray-500 transition-colors hover:bg-gray-50"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <p className="text-xs text-gray-400">{t('admin.tempPasswordNote')}</p>

          {errorMsg && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">{errorMsg}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <Button
              size="lg"
              loading={status === 'loading'}
              onClick={handleConfirm}
              className="flex-1"
            >
              {t('admin.setThisPassword')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}