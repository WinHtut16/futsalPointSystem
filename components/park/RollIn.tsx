'use client'

import { useEffect, useRef } from 'react'

// Text that rolls up into place the first time it scrolls into view (the
// `.roll` classes in park.css). Like LivePhoto, only text still below the
// fold is armed, so nothing is hidden before script runs or if it never does.
export default function RollIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return
    el.classList.add('is-armed')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('is-seen')
          io.disconnect()
        }
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <span ref={ref} className="roll">
      <span>{children}</span>
    </span>
  )
}
