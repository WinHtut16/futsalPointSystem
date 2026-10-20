'use client'

import { useEffect, useRef } from 'react'
import type { PhotoKey } from '@/lib/park/photos'
import ParkPhoto from './ParkPhoto'
import { attachTilt } from './tilt'

// A park photo that comes alive (the `lp-*` classes in park.css):
//  - Reveal: photos still below the fold wipe open from the bottom, with the
//    image settling from a slight zoom, when they scroll into view. Photos
//    already on screen are never hidden, and nothing is hidden until script
//    has run, so a failed or paused animation can't leave a blank frame.
//  - Depth: while on screen the image drifts a little slower than the page
//    inside its frame (one shared scroll listener for every LivePhoto).
//  - Hover (mouse/trackpad only): the frame tilts toward the pointer and a
//    soft light follows it; the light's colour fits the scene.
// Reduced-motion visitors get the plain photo.

export type PhotoLight = 'water' | 'warm' | 'lights'

const DRIFT_PX = 26

// ── Shared depth drift ───────────────────────────────────────────────────────
const active = new Set<HTMLElement>()
let listening = false

function drift() {
  const ih = window.innerHeight
  // Read every position first, then write, so the browser lays out once.
  const reads = Array.from(active, (el) => {
    const r = el.getBoundingClientRect()
    return [el, (r.top + r.height / 2 - ih / 2) / ih] as const
  })
  for (const [el, p] of reads) {
    el.style.setProperty('--lp-y', `${(-p * DRIFT_PX).toFixed(1)}px`)
  }
}

function track(el: HTMLElement, on: boolean) {
  if (on) active.add(el)
  else active.delete(el)
  if (active.size > 0 && !listening) {
    window.addEventListener('scroll', drift, { passive: true })
    window.addEventListener('resize', drift)
    listening = true
  } else if (active.size === 0 && listening) {
    window.removeEventListener('scroll', drift)
    window.removeEventListener('resize', drift)
    listening = false
  }
  if (on) drift()
}

export default function LivePhoto({
  photo,
  sizes,
  className = '',
  wrapClass = '',
  light,
  priority,
}: {
  photo: PhotoKey
  sizes: string
  /** Shape of the photo frame (aspect ratio, radius), as for ParkPhoto. */
  className?: string
  /** Layout classes for the outer box (grid order, width). */
  wrapClass?: string
  light: PhotoLight
  priority?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Reveal: arm only what is still out of sight.
    const reveal = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('is-seen')
          reveal.disconnect()
        }
      },
      { threshold: 0.18 },
    )
    if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
      el.classList.add('is-armed')
      reveal.observe(el)
    }

    // Depth: only photos on (or near) the screen take part.
    const near = new IntersectionObserver((entries) => entries.forEach((e) => track(el, e.isIntersecting)), {
      rootMargin: '15% 0px',
    })
    near.observe(el)

    // Tilt + light: real hover devices only (components/park/tilt.ts).
    const untilt = attachTilt(el, { prefix: '--lp', rx: 5, ry: 7 })

    return () => {
      reveal.disconnect()
      near.disconnect()
      track(el, false)
      untilt()
    }
  }, [])

  return (
    <div ref={wrap} className={`lp ${wrapClass}`} data-light={light}>
      <ParkPhoto photo={photo} sizes={sizes} priority={priority} className={`lp-frame ${className}`}>
        <span aria-hidden="true" className="lp-sheen" />
      </ParkPhoto>
    </div>
  )
}
