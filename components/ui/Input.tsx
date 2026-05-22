'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  showPasswordToggle?: boolean
}

export default function Input({ label, error, className, id, showPasswordToggle, type, ...props }: InputProps) {
  const [shown, setShown] = useState(false)

  const input = (
    <input
      id={id}
      type={showPasswordToggle ? (shown ? 'text' : 'password') : type}
      className={cn(
        'w-full rounded-xl border px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition',
        showPasswordToggle && 'pr-10',
        error ? 'border-red-400' : 'border-gray-300',
        className
      )}
      {...props}
    />
  )

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      {showPasswordToggle ? (
        <div className="relative">
          {input}
          <button
            type="button"
            tabIndex={-1}
            aria-label={shown ? 'Hide password' : 'Show password'}
            onClick={() => setShown((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {shown ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      ) : input}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
