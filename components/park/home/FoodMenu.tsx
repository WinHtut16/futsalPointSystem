'use client'

import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { FOOD_HOUSE } from '@/lib/park/content'

// Family Garden's menu: the client's printed QR card (the same one on the
// tables) beside a button that opens the menu file directly, since a QR on
// the screen you are holding can't be scanned.
export default function FoodMenu() {
  const { t } = useLanguage()
  return (
    <div className="flex max-w-[520px] items-center gap-4 sm:gap-6 rounded-[22px] bg-white/70 p-3 pr-5 shadow-[0_1px_0_rgb(176_96_0/0.12)]">
      <a
        href={FOOD_HOUSE.menuUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 overflow-hidden rounded-2xl ring-1 ring-[#b06000]/15 transition-transform hover:-rotate-2"
        tabIndex={-1}
        aria-hidden="true"
      >
        <Image
          src={FOOD_HOUSE.menuQr}
          alt=""
          width={400}
          height={400}
          sizes="(min-width: 640px) 184px, 128px"
          className="h-[128px] w-[128px] sm:h-[184px] sm:w-[184px]"
        />
      </a>
      {/* The decorative link above is hidden from assistive tech; the image's
          meaning is carried by this text and the button. */}
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-[15px] leading-snug text-[#3a3a24]">
          <span className="sr-only">{t('park.food.qrAlt')}. </span>
          {t('park.food.menuNote')}
        </p>
        <a
          href={FOOD_HOUSE.menuUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] w-fit items-center gap-2 whitespace-nowrap rounded-full bg-[#9a5300] px-5 font-semibold text-white transition-colors hover:bg-[#7a4100]"
        >
          {t('park.food.viewMenu')}
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        <span className="text-xs text-[#5c4a2e]">{t('park.food.opensDrive')}</span>
      </div>
    </div>
  )
}
