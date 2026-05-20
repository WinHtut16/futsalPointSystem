'use client'

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

const LEVELS = [
  { label: 'Weak',   color: 'bg-red-500' },
  { label: 'Fair',   color: 'bg-orange-400' },
  { label: 'Good',   color: 'bg-yellow-400' },
  { label: 'Strong', color: 'bg-green-500' },
]

export default function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null
  const score = calcStrength(password)
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
      <p className={`text-xs font-medium ${
        score === 1 ? 'text-red-500' :
        score === 2 ? 'text-orange-500' :
        score === 3 ? 'text-yellow-600' :
        'text-green-600'
      }`}>
        {level.label} password
      </p>
    </div>
  )
}
