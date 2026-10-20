'use client'

import { useEffect, type RefObject } from 'react'
import { attachTilt, canTilt } from '../tilt'

// "The room switching on": the /games motion, wired once for the whole page.
//   - Section signs (h2 tubes) flicker on the first time they come into view.
//   - The floor plan ([data-boot]) boots: each TV powers on in turn.
//   - Library rows (.gl-row) slide their cards in from the right.
//   - Game covers tilt toward the pointer with their console's neon edge.
//   - A soft light follows the pointer over the dark page.
// Same safety rule as the landing: only things still below the fold are
// "armed" (dimmed/offset) before they animate, so nothing is hidden if
// script or animation never runs; reduced motion gets none of it; tilt and
// the light only for mouse/trackpad. Styles: .sw-*, .boot-*, .gl-row.*,
// .arc-glow in park.css.
export function useArcadeMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const below = (n: Element) => n.getBoundingClientRect().top > window.innerHeight * 0.85
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const n = e.target as HTMLElement
          io.unobserve(n)
          if (n.classList.contains('sw-armed')) {
            n.classList.remove('sw-armed')
            n.classList.add('arc-flicker')
          } else if (n.classList.contains('boot-armed')) {
            n.classList.replace('boot-armed', 'is-booting')
          } else {
            n.classList.add('is-seen')
          }
        }
      },
      { threshold: 0.25 },
    )
    const arm = (n: Element, cls: string) => {
      if (!below(n)) return
      n.classList.add(cls)
      io.observe(n)
    }
    el.querySelectorAll('h2.arc-sign-soft').forEach((n) => arm(n, 'sw-armed'))
    el.querySelectorAll('[data-boot]').forEach((n) => arm(n, 'boot-armed'))
    el.querySelectorAll('.gl-row').forEach((n) => arm(n, 'is-armed'))

    // Cover tilt: one listener for every card in the library.
    const lib = el.querySelector<HTMLElement>('[aria-labelledby="games-library"]')
    const untilt = lib
      ? attachTilt(lib, { prefix: '--gt', rx: 9, ry: 12, target: (t) => t.closest<HTMLElement>('.gl-card') })
      : () => {}

    // Pointer light.
    let frame = 0
    let x = 0
    let y = 0
    const glow = canTilt()
    const paint = () => {
      frame = 0
      el.style.setProperty('--gx', `${x}px`)
      el.style.setProperty('--gy', `${y}px`)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      el.classList.add('glow-on')
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const leave = () => el.classList.remove('glow-on')
    if (glow) {
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerleave', leave)
    }

    return () => {
      io.disconnect()
      untilt()
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [root])
}
