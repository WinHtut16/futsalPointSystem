'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import SunArc from './SunArc'

// The sun travels the day as you scroll "A day at MyaThida". Each section's
// time label carries data-day-hour (8, 12.5, 16, 19.5); the hour shown is
// interpolated from where the middle of the screen sits between those labels,
// so the sun is overhead at 12:30 and sets on the way from 16:00 to the
// evening. The end of the story counts as 22:00. A small pinned badge shows
// the sun (moon after dusk) and the clock of the section you are in: under
// the two-row nav on phones and tablets, bottom right on desktop, where it
// sits over photos rather than the left-aligned text and buttons.
//
// One passive scroll listener doing a few comparisons and at most one small
// re-render; label positions are measured once and again on resize. Purely decorative (aria-hidden):
// every time it shows is already on the page as text.

type Anchor = { y: number; hour: number; label: string }

const END_HOUR = 22

function measure(root: HTMLElement): Anchor[] {
  const scrollY = window.scrollY
  const anchors = Array.from(root.querySelectorAll<HTMLElement>('[data-day-hour]')).map((el) => {
    const r = el.getBoundingClientRect()
    return { y: r.top + scrollY + r.height / 2, hour: Number(el.dataset.dayHour), label: el.textContent ?? '' }
  })
  const end = root.getBoundingClientRect().bottom + scrollY
  const last = anchors[anchors.length - 1]
  if (last) anchors.push({ y: end, hour: END_HOUR, label: last.label })
  return anchors.sort((a, b) => a.y - b.y)
}

/** Hour at document position y, linear between anchors; also the label of the section reached. */
function hourAt(anchors: Anchor[], y: number, snap: boolean): { hour: number; label: string } {
  const first = anchors[0]
  if (y <= first.y) return { hour: first.hour, label: first.label }
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    if (y < b.y) {
      if (snap) return { hour: a.hour, label: a.label }
      const t = (y - a.y) / Math.max(1, b.y - a.y)
      return { hour: a.hour + (b.hour - a.hour) * t, label: a.label }
    }
  }
  const last = anchors[anchors.length - 1]
  return { hour: last.hour, label: last.label }
}

// Badge ground follows the sky: noon cream, afternoon apricot, dusk navy.
function tone(hour: number) {
  if (hour < 14) return 'bg-park-noon/95 text-park-ink'
  if (hour < 18) return 'bg-park-afternoon/95 text-park-ink'
  return 'bg-park-dusk/95 text-[#eaf0f7]'
}

export default function DaySky({ root }: { root: RefObject<HTMLElement | null> }) {
  const [state, setState] = useState<{ hour: number; label: string; inView: boolean }>({
    hour: 8,
    label: '',
    inView: false,
  })
  const anchors = useRef<Anchor[]>([])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0

    const update = () => {
      frame = 0
      if (anchors.current.length === 0) return
      const mid = window.scrollY + window.innerHeight * 0.5
      const first = anchors.current[0]
      const end = anchors.current[anchors.current.length - 1]
      // Shown from the first time label until the story ends (the gallery).
      const inView = mid >= first.y - window.innerHeight * 0.25 && mid <= end.y
      const { hour } = hourAt(anchors.current, mid, reduce.matches)
      // The clock flips as soon as the next time heading is well in view (lower
      // third of the screen), not only once it has passed the middle.
      const { label } = hourAt(anchors.current, window.scrollY + window.innerHeight * 0.7, true)
      setState((s) =>
        s.inView === inView && s.label === label && Math.abs(s.hour - hour) < 0.02 ? s : { hour, label, inView },
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const remeasure = () => {
      anchors.current = measure(el)
      schedule()
    }

    remeasure()
    // Photos and fonts shift the layout after first paint; re-measure then too.
    const ro = new ResizeObserver(remeasure)
    ro.observe(el)
    // Browsers already deliver scroll once per frame; updating right away keeps
    // the sun on the finger (a rAF hop adds a frame of lag, more when throttled).
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', remeasure)
    reduce.addEventListener('change', remeasure)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      ro.disconnect()
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', remeasure)
      reduce.removeEventListener('change', remeasure)
    }
  }, [root])

  const night = state.hour >= 18 || state.hour < 6
  return (
    <div
      aria-hidden="true"
      className={`day-sky pointer-events-none fixed right-3 top-[128px] z-20 flex items-center gap-2.5 rounded-2xl px-3 py-2 shadow-[0_8px_30px_rgb(11_30_45/0.18)] backdrop-blur-sm md:gap-3 md:px-4 md:py-3 lg:bottom-6 lg:right-6 lg:top-auto ${tone(
        state.hour,
      )} ${state.inView ? 'is-in' : ''}`}
    >
      <SunArc hour={state.hour} open tone={night ? 'dark' : 'light'} scrub className="h-8 w-[52px] md:h-10 md:w-16" />
      <span key={state.label} className="day-sky-clock park-display min-w-[3.2em] text-lg tabular-nums md:text-xl">
        {state.label}
      </span>
    </div>
  )
}
