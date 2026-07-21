'use client'

import { useEffect, useState, useCallback } from 'react'

// 'ios' / 'macos-safari' get step-by-step instructions (Apple blocks the
// native prompt everywhere). 'other' covers desktop Chromium (shows the
// native prompt when canPrompt is true) and unsupported browsers like
// Firefox (falls back to generic instructions when canPrompt is false).
type Platform = 'ios' | 'macos-safari' | 'other'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface UsePwaInstallResult {
  /** True once the page is already running as the installed standalone app. */
  isStandalone: boolean
  /** Best-guess platform, used to pick the right UI (native prompt vs instructions). */
  platform: Platform
  /** True when the native beforeinstallprompt event is available to trigger. */
  canPrompt: boolean
  /** Triggers the native install dialog. No-op (resolves false) if canPrompt is false. */
  promptInstall: () => Promise<boolean>
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua)
  if (isIos) return 'ios'
  if (ua.includes('Macintosh') && isSafari) return 'macos-safari'
  return 'other'
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mql = window.matchMedia?.('(display-mode: standalone)').matches
  // iOS Safari exposes this non-standard boolean instead of display-mode.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return Boolean(mql || iosStandalone)
}

export function usePwaInstall(): UsePwaInstallResult {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')

  useEffect(() => {
    setIsStandalone(detectStandalone())
    setPlatform(detectPlatform())

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredEvent(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setDeferredEvent(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return false
    await deferredEvent.prompt()
    const { outcome } = await deferredEvent.userChoice
    setDeferredEvent(null)
    return outcome === 'accepted'
  }, [deferredEvent])

  return {
    isStandalone,
    platform,
    canPrompt: deferredEvent !== null,
    promptInstall,
  }
}
