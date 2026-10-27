'use client'

import { GlassWater, PawPrint, Shirt, ShoppingBag, ShowerHead, Thermometer, type LucideIcon } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { POOL_RULES, type PoolRule, type PoolRuleIcon } from '@/lib/park/pool-rules'

// The pool's six signs, drawn the way they hang on the fence: a white plate
// with a coloured frame, the English title in the top band, a pictogram, the
// Burmese text, and the English sentence in the bottom band. Red for "don't",
// blue for "do", as on the real signs (ISO 7010).

const ICONS: Record<PoolRuleIcon, LucideIcon> = {
  pet: PawPrint,
  shower: ShowerHead,
  unwell: Thermometer,
  swimwear: Shirt,
  glass: GlassWater,
  outsideFood: ShoppingBag,
}

const KIND = {
  ban: { band: 'bg-[#b42318]', frame: 'border-[#b42318]' },
  must: { band: 'bg-[#0b5cad]', frame: 'border-[#0b5cad]' },
}

function Pictogram({ rule }: { rule: PoolRule }) {
  const Icon = ICONS[rule.key]
  if (rule.kind === 'must') {
    return (
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0b5cad] text-white">
        <Icon size={52} strokeWidth={2.4} aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className="relative flex h-24 w-24 items-center justify-center text-[#141414]">
      <Icon size={50} strokeWidth={2.6} aria-hidden="true" />
      <svg viewBox="0 0 96 96" aria-hidden="true" className="absolute inset-0 h-full w-full">
        <circle cx="48" cy="48" r="43" fill="none" stroke="#b42318" strokeWidth="8" />
        <path d="M18 18 L78 78" stroke="#b42318" strokeWidth="8" />
      </svg>
    </span>
  )
}

function Sign({ rule }: { rule: PoolRule }) {
  const { lang } = useLanguage()
  const k = KIND[rule.kind]
  return (
    <li className="pool-sign relative rounded-[14px] bg-white p-2.5 shadow-[0_1px_0_rgb(15_77_60/0.1),0_14px_30px_-18px_rgb(15_77_60/0.45)]">
      {/* Mounting screws. */}
      {['left-1 top-1', 'right-1 top-1', 'bottom-1 left-1', 'bottom-1 right-1'].map((pos) => (
        <span key={pos} aria-hidden="true" className={`absolute ${pos} h-1.5 w-1.5 rounded-full bg-[#c9d3d0]`} />
      ))}
      <article className={`flex h-full flex-col overflow-hidden rounded-[9px] border-[3px] ${k.frame}`}>
        <h3 className={`${k.band} px-4 py-2.5 text-center text-xl font-bold tracking-tight text-white`} lang="en">
          {rule.title}
        </h3>
        <div className="flex flex-1 flex-col items-center gap-4 px-5 py-6">
          <Pictogram rule={rule} />
          <p
            lang="my"
            className={`text-center font-semibold leading-relaxed text-park-ink ${lang === 'my' ? 'text-lg' : 'text-base'}`}
          >
            {rule.my}
          </p>
        </div>
        <p lang="en" className={`${k.band} px-4 py-3 text-center font-semibold leading-snug text-white`}>
          {rule.en}
        </p>
      </article>
    </li>
  )
}

export default function PoolRules() {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {POOL_RULES.map((rule) => (
        <Sign key={rule.key} rule={rule} />
      ))}
    </ul>
  )
}
