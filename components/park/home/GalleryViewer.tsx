'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { PHOTOS } from '@/lib/park/photos'
import { formatAmount } from '@/lib/park/time'
import type { GalleryShot } from './Gallery'

// Full-screen photo viewer for the gallery. A native <dialog> (focus trap,
// Esc, top layer for free). Arrow keys, the side buttons or a swipe move
// through the photos; only the open photo is loaded at full size. The photo
// carries view-transition-name "gallery-photo" so, where supported, it grows
// out of the print that was tapped (Gallery.tsx starts the transition).
export default function GalleryViewer({
  shots,
  index,
  onIndex,
  onClose,
}: {
  shots: GalleryShot[]
  index: number | null
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const { t, lang } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const swipeX = useRef<number | null>(null)
  const n = shots.length

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (index !== null && !d.open) d.showModal()
    if (index === null && d.open) d.close()
  }, [index])

  const go = (dir: 1 | -1) => {
    if (index === null) return
    onIndex((index + dir + n) % n)
  }

  const shot = index !== null ? shots[index] : null
  const photo = shot ? PHOTOS[shot.photo] : null
  const caption = photo ? t(photo.alt) : ''
  const btn =
    'flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-park-sun'

  return (
    <dialog
      ref={dialog}
      aria-label={t('park.gallery.viewer')}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      onClick={(e) => {
        // A click on the dark backdrop (the dialog itself) closes it.
        if (e.target === e.currentTarget) dialog.current?.close()
      }}
      className="gv m-0 h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 text-[#eaf0f7]"
    >
      {shot && photo && (
        <div
          className="flex h-full w-full flex-col"
          onPointerDown={(e) => {
            swipeX.current = e.clientX
          }}
          onPointerUp={(e) => {
            if (swipeX.current === null) return
            const dx = e.clientX - swipeX.current
            swipeX.current = null
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
          }}
        >
          <div className="flex items-center justify-between gap-4 px-4 pt-4 md:px-8 md:pt-6">
            <p className="text-sm tabular-nums text-[#a9b8cb]" aria-live="polite">
              {t('park.gallery.count', { n: formatAmount((index ?? 0) + 1, lang), total: formatAmount(n, lang) })}
            </p>
            <button type="button" className={btn} onClick={() => dialog.current?.close()} aria-label={t('park.gallery.close')} autoFocus>
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center gap-3 px-2 py-4 md:px-6">
            <button type="button" className={`${btn} hidden shrink-0 sm:flex`} onClick={() => go(-1)} aria-label={t('park.gallery.prev')}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <div
              key={shot.photo}
              className="gv-photo relative h-full w-full max-w-[1400px]"
              style={{ viewTransitionName: 'gallery-photo' }}
            >
              <Image src={photo.file} alt={caption} fill sizes="100vw" className="object-contain" priority />
            </div>
            <button type="button" className={`${btn} hidden shrink-0 sm:flex`} onClick={() => go(1)} aria-label={t('park.gallery.next')}>
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 pb-5 md:px-8 md:pb-7">
            <button type="button" className={`${btn} sm:hidden`} onClick={() => go(-1)} aria-label={t('park.gallery.prev')}>
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <p className="flex-1 text-center text-[15px] leading-snug md:text-base">{caption}</p>
            <button type="button" className={`${btn} sm:hidden`} onClick={() => go(1)} aria-label={t('park.gallery.next')}>
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
