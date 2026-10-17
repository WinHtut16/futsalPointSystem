'use client'

import { openViber } from '@/lib/viber'
import { PARK } from '@/lib/park/content'

// Viber chat link for the park pages. Keeps the deep link as href (works
// without JS) and hands clicks to openViber(), which picks the iOS scheme and
// falls back to the app store, same as the futsal site.
export default function ViberLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a
      href={PARK.viberUrl}
      onClick={(e) => {
        e.preventDefault()
        openViber()
      }}
      className={className}
    >
      {children}
    </a>
  )
}
