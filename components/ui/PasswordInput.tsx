'use client'

import Input from '@/components/ui/Input'
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter'
import type { InputHTMLAttributes } from 'react'

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  /** Show strength meter below input. Use on "new password" / primary password fields only. */
  showStrength?: boolean
}

/**
 * Password input with eye-toggle always enabled.
 * Optionally renders PasswordStrengthMeter below (showStrength=true).
 * Use for every password field in the app — never use bare <Input type="password">.
 */
export default function PasswordInput({ showStrength, value, ...props }: PasswordInputProps) {
  return (
    <div className="space-y-1">
      <Input
        {...props}
        type="password"
        showPasswordToggle
        value={value}
      />
      {showStrength && (
        <PasswordStrengthMeter password={typeof value === 'string' ? value : ''} />
      )}
    </div>
  )
}
