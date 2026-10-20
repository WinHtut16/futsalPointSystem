'use client'

import { useEffect, useRef, useState } from 'react'

// A number that ticks up like an LED display: from 0 the first time it is
// on screen, and from its old value whenever it changes (a live count going
// from 6 to 7). Until it has been seen, and for reduced motion, it shows the
// real value. Callers format: children receives the number to show.
export default function CountUp({
  value,
  duration = 900,
  children,
}: {
  value: number
  duration?: number
  children: (shown: number) => React.ReactNode
}) {
  const [shown, setShown] = useState(value)
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef<number | null>(null)
  const seen = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    let frame = 0
    const run = (start: number) => {
      const t0 = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / duration)
        const eased = 1 - Math.pow(1 - k, 3)
        setShown(Math.round(start + (value - start) * eased))
        if (k < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }

    if (seen.current) {
      run(from.current ?? value)
    } else {
      // First time: keep showing the real value (never a false "0" if the
      // observer is late or never fires), then count up from zero once seen.
      setShown(value)
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return
        seen.current = true
        io.disconnect()
        run(0)
      })
      io.observe(el)
      return () => {
        io.disconnect()
        cancelAnimationFrame(frame)
        from.current = value
      }
    }
    return () => {
      cancelAnimationFrame(frame)
      from.current = value
    }
  }, [value, duration])

  return <span ref={ref}>{children(shown)}</span>
}
