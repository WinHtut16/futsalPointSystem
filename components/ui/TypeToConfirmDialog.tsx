'use client'

import { useEffect, useId, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TypeToConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  /** Kept in English regardless of UI language — see DESIGN.md. */
  confirmWord: string
  confirmLabel?: string
  cancelLabel?: string
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

/**
 * Destructive-confirmation tier 2 — irreversible bulk actions. See
 * DESIGN.md's "Destructive confirmation" section. Tier 1 is ConfirmModal;
 * tier 3 (reason-required correction) is inline within the record being
 * corrected, not a dialog.
 */
export default function TypeToConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmWord,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isLoading = false,
}: TypeToConfirmDialogProps) {
  const titleId = useId()
  const inputId = useId()
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setTyped('')
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const matches = typed === confirmWord

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-in fade-in duration-150"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 id={titleId} className="text-center text-base font-bold text-gray-900">{title}</h3>
        <p className="mt-1.5 text-center text-sm text-gray-500">{message}</p>

        <label htmlFor={inputId} className="mt-4 block text-sm font-medium text-gray-700 mb-1">
          Type <span className="font-mono font-semibold text-gray-900">{confirmWord}</span> to confirm
        </label>
        <input
          id={inputId}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={isLoading}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition"
        />

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
            disabled={isLoading || !matches}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
              'bg-red-600 hover:bg-red-700'
            )}
          >
            {isLoading && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
