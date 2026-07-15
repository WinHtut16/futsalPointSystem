'use client'

import { useEffect, useState } from 'react'
import { Download, Database, CalendarRange, CalendarDays, CalendarClock, CheckCircle2, AlertCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import PeriodSelector from '@/components/admin/analytics/PeriodSelector'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type Mode = 'full' | 'thisMonth' | 'month' | 'range'

function yangonParts() {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Yangon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [y, m] = s.split('-').map(Number)
  return { year: y, month: m, iso: s }
}

export default function ExportPanel() {
  const { t } = useLanguage()
  const now = yangonParts()

  const [mode, setMode] = useState<Mode>('full')
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  function buildQuery(m: Mode): string | null {
    if (m === 'full') return 'scope=all'
    if (m === 'thisMonth') return `scope=month&month=${now.month}&year=${now.year}`
    if (m === 'month') return `scope=month&month=${month}&year=${year}`
    // range
    if (!from || !to) return null
    return `scope=range&from=${from}&to=${to}`
  }

  async function download(m: Mode) {
    const qs = buildQuery(m)
    if (!qs) {
      setToast({ type: 'err', msg: t('admin.exportRangeError') })
      return
    }
    setLoading(true)
    setToast(null)
    try {
      const res = await fetch(`/api/admin/export?${qs}`)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()

      // filename from Content-Disposition, with a client fallback
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] ?? `myathida-backup-${now.iso}.xlsx`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setToast({ type: 'ok', msg: t('admin.exportSuccess') })
    } catch {
      setToast({ type: 'err', msg: t('admin.exportError') })
    } finally {
      setLoading(false)
    }
  }

  const options: { id: Mode; label: string; hint?: string; Icon: typeof Database }[] = [
    { id: 'full', label: t('admin.exportScopeFull'), hint: t('admin.exportScopeFullHint'), Icon: Database },
    { id: 'thisMonth', label: t('admin.exportScopeThisMonth'), Icon: CalendarClock },
    { id: 'month', label: t('admin.exportScopeMonth'), Icon: CalendarDays },
    { id: 'range', label: t('admin.exportScopeRange'), Icon: CalendarRange },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('admin.exportTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('admin.exportSubtitle')}</p>
      </div>

      {/* Prominent full-backup CTA */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Database className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">{t('admin.exportScopeFull')}</p>
            <p className="text-xs text-gray-500">{t('admin.exportScopeFullHint')}</p>
          </div>
          <Button onClick={() => download('full')} loading={loading} className="shrink-0">
            <Download className="mr-2 h-4 w-4" />
            {t('admin.exportDownloadFull')}
          </Button>
        </div>
      </div>

      {/* Scope selector */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {options.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                mode === id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {mode === 'month' && (
          <PeriodSelector
            month={month}
            year={year}
            minYear={2024}
            maxYear={now.year}
            onNavigate={(m, y) => {
              setMonth(m)
              setYear(y)
            }}
          />
        )}

        {mode === 'range' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs font-medium text-gray-600">
              {t('admin.exportFrom')}
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="flex flex-col text-xs font-medium text-gray-600">
              {t('admin.exportTo')}
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>
        )}

        <Button onClick={() => download(mode)} loading={loading} variant="secondary">
          <Download className="mr-2 h-4 w-4" />
          {t('admin.exportDownload')}
        </Button>

        <p className="text-xs text-gray-400">{t('admin.exportNote')}</p>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            toast.type === 'ok'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
