'use client'

import { useState } from 'react'
import { Zap, Pencil, Check, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface EarningRuleCardProps {
  rate: number
}

export default function EarningRuleCard({ rate: initialRate }: EarningRuleCardProps) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [rate, setRate] = useState(initialRate)
  const [draft, setDraft] = useState(String(initialRate))

  function handleSave() {
    const v = parseInt(draft, 10)
    if (v > 0) setRate(v)
    setEditing(false)
  }

  function handleCancel() {
    setDraft(String(rate))
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Zap className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{t('admin.earningRuleTitle')}</p>
        {editing ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <input
              type="number"
              min={1}
              max={999}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
              className="w-16 text-sm font-bold text-gray-900 border border-gray-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
            <span className="text-sm text-gray-400">pts / hr</span>
          </div>
        ) : (
          <p className="text-lg font-bold text-gray-900 leading-tight">
            {rate} <span className="text-sm font-normal text-gray-400">pts / hr</span>
          </p>
        )}
      </div>
      {editing ? (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={handleSave}
            className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCancel}
            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
          title="Edit earning rate"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
