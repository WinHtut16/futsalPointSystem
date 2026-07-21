'use client'

import { useEffect, useState } from 'react'
import { Download, Smartphone, Share, Check } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

export default function InstallAppCard() {
  const { t, lang } = useLanguage()
  const my = lang === 'my' ? 'my' : ''
  const { isStandalone, platform, canPrompt, promptInstall } = usePwaInstall()

  const [mounted, setMounted] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [installing, setInstalling] = useState(false)

  // Client-only render: isStandalone/platform/canPrompt are all unknown
  // until the effect in usePwaInstall runs, so SSR would flash the wrong
  // state. Registration also only happens here — on an authenticated
  // admin page — never anywhere customer-facing could import this component.
  useEffect(() => {
    setMounted(true)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/admin' }).catch((err) => {
        console.error('[pwa] service worker registration failed:', err)
      })
    }
  }, [])

  async function handleInstallClick() {
    setInstalling(true)
    try {
      await promptInstall()
    } finally {
      setInstalling(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className={`mb-4 text-sm font-semibold text-gray-700 ${my}`}>
        {t('admin.installTitle')}
      </h2>

      {isStandalone ? (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <Check className="h-4 w-4 shrink-0" />
          <span className={my}>{t('admin.installed')}</span>
        </div>
      ) : (
        <>
          <p className={`mb-4 text-sm text-gray-500 ${my}`}>{t('admin.installDesc')}</p>
          {canPrompt ? (
            <Button type="button" loading={installing} onClick={handleInstallClick} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              <span className={my}>{t('admin.installButton')}</span>
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setShowHelp(true)} className="w-full">
              <Smartphone className="mr-2 h-4 w-4" />
              <span className={my}>{t('admin.installHowButton')}</span>
            </Button>
          )}
        </>
      )}

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title={t('admin.installHowButton')}>
        {platform === 'ios' && (
          <div className="space-y-2 text-sm text-gray-600">
            <p className={`font-semibold text-gray-800 ${my}`}>{t('admin.installIosTitle')}</p>
            <p className={my}>
              <Share className="mr-1 inline h-4 w-4 align-text-bottom" />
              {t('admin.installIosSteps')}
            </p>
          </div>
        )}
        {platform === 'macos-safari' && (
          <div className="space-y-2 text-sm text-gray-600">
            <p className={`font-semibold text-gray-800 ${my}`}>{t('admin.installMacTitle')}</p>
            <p className={my}>{t('admin.installMacSteps')}</p>
          </div>
        )}
        {platform === 'other' && (
          <div className="space-y-2 text-sm text-gray-600">
            <p className={`font-semibold text-gray-800 ${my}`}>{t('admin.installOtherTitle')}</p>
            <p className={my}>{t('admin.installOtherSteps')}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
