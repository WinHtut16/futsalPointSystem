'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  password: string
}

export function calcStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8)  score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return 1
  if (score === 2) return 2
  if (score === 3) return 3
  return 4
}

const LEVEL_COLORS = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']
const LEVEL_TEXT_COLORS = ['text-red-500', 'text-orange-500', 'text-yellow-600', 'text-green-600']

export default function PasswordStrengthMeter({ password }: Props) {
  const { t } = useLanguage()
  if (!password) return null
  const score = calcStrength(password)

  const LEVELS = [
    { label: t('auth.strengthWeak'),   color: LEVEL_COLORS[0] },
    { label: t('auth.strengthFair'),   color: LEVEL_COLORS[1] },
    { label: t('auth.strengthGood'),   color: LEVEL_COLORS[2] },
    { label: t('auth.strengthStrong'), color: LEVEL_COLORS[3] },
  ]

  const level = LEVELS[score - 1]

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {LEVELS.map((l, i) => (
          <div
            key={l.label}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              i < score ? level.color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${LEVEL_TEXT_COLORS[score - 1]}`}>
        {level.label}
      </p>
    </div>
  )
}
