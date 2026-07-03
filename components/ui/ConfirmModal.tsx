'use client'

import { useEffect } from 'react'
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  isLoading?: boolean
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const iconWrapperClass = cn(
    'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full',
    variant === 'danger' && 'bg-red-100',
    variant === 'warning' && 'bg-amber-100',
    variant === 'default' && 'bg-gray-100',
  )

  const iconClass = cn(
    'h-6 w-6',
    variant === 'danger' && 'text-red-600',
    variant === 'warning' && 'text-amber-600',
    variant === 'default' && 'text-gray-500',
  )

  const confirmClass = cn(
    'flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
    variant === 'danger' && 'bg-red-600 hover:bg-red-700',
    variant === 'warning' && 'bg-amber-500 hover:bg-amber-600',
    variant === 'default' && 'bg-primary hover:bg-primary-dark',
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className={iconWrapperClass}>
          {variant === 'danger' && <Trash2 className={iconClass} />}
          {variant === 'warning' && <AlertTriangle className={iconClass} />}
          {variant === 'default' && <HelpCircle className={iconClass} />}
        </div>
        <h3 className="text-center text-base font-bold text-gray-900">{title}</h3>
        <p className="mt-1.5 text-center text-sm text-gray-500">{message}</p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmClass}
          >
            {isLoading && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
