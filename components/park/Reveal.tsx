'use client'

import { createElement, useEffect, useRef } from 'react'

// Content that rises into place the first time it scrolls into view (the
// `.rv` classes in park.css). With `stagger`, each direct child follows the
// one before it, for lists and grids.
//
// Same safety rule as LivePhoto and RollIn: only content still below the
// fold is armed, after script has run, so a paused or frozen animation can
// never leave a blank section. Reduced-motion visitors get it static.

/** Arms `el` for a one-off reveal; adds `is-seen` when it scrolls in. */
export function armReveal(el: Element, threshold = 0.15): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return () => {}
  el.classList.add('is-armed')
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        el.classList.add('is-seen')
        io.disconnect()
      }
    },
    { threshold },
  )
  io.observe(el)
  return () => io.disconnect()
}

export default function Reveal({
  children,
  as = 'div',
  className = '',
  stagger = false,
  ...rest
}: {
  children: React.ReactNode
  as?: 'div' | 'ul' | 'dl' | 'section'
  className?: string
  stagger?: boolean
} & Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className'>) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => (ref.current ? armReveal(ref.current) : undefined), [])
  return createElement(as, { ref, className: `${stagger ? 'rv-stagger' : 'rv'} ${className}`, ...rest }, children)
}
