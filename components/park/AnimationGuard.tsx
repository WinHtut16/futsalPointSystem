'use client'

import { useEffect } from 'react'

// Some phones (battery savers, "animations off" modes that don't report
// prefers-reduced-motion) stop CSS animations and transitions entirely. The
// park's effects would then stay on their first frame: faded hero text, an
// invisible sun badge. If the page's animation clock hasn't moved after a
// second of being on screen, `park-still` on the park root turns every
// animation and transition off, so everything shows in its final state.
export default function AnimationGuard() {
  useEffect(() => {
    const timeline = document.timeline as AnimationTimeline | undefined
    if (!timeline || typeof timeline.currentTime !== 'number') return
    let timer = 0
    let start = 0
    let startTime = 0

    const begin = () => {
      window.clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      start = Number(timeline.currentTime)
      startTime = performance.now()
      timer = window.setTimeout(check, 1200)
    }
    const check = () => {
      // A hidden tab pauses the clock on purpose; try again when it is back.
      if (document.visibilityState !== 'visible') return
      const advanced = Number(timeline.currentTime) - start
      const elapsed = performance.now() - startTime
      if (advanced < elapsed * 0.2) {
        document.querySelector('.park')?.classList.add('park-still')
      }
    }

    begin()
    document.addEventListener('visibilitychange', begin)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', begin)
    }
  }, [])

  return null
}
