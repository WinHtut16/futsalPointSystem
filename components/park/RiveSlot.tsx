'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { RIVE, type RiveKey } from '@/lib/park/rive'

export type RiveValues = {
  numbers?: Record<string, number>
  booleans?: Record<string, boolean>
  /** Fires the named trigger each time its counter changes (skip 0). */
  triggers?: Record<string, number>
}

// The runtime (~150 kB JS plus ~2 MB WASM) loads only when a slot that has a
// ready file scrolls near the viewport, so pages without Rive pay nothing.
const RivePlayer = dynamic(() => import('./RivePlayer'), { ssr: false })

/**
 * A Rive animation with a code-drawn fallback. The fallback renders first and
 * stays if the file is not ready, fails to load, or the visitor prefers
 * reduced motion. `className` sizes the slot; the canvas fills it.
 */
export default function RiveSlot({
  anim,
  fallback,
  className = '',
  style,
  label,
  values,
}: {
  anim: RiveKey
  fallback: React.ReactNode
  className?: string
  style?: React.CSSProperties
  /** Accessible name; omit for decorative slots. */
  label?: string
  values?: RiveValues
}) {
  const spec = RIVE[anim]
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!spec.ready) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setAllowed(!mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [spec.ready])

  useEffect(() => {
    if (!allowed || near || !ref.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true)
      },
      { rootMargin: '200px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [allowed, near])

  const live = allowed && near && !failed

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <div className={`h-full w-full transition-opacity duration-300 ${live && loaded ? 'opacity-0' : 'opacity-100'}`}>
        {fallback}
      </div>
      {live && (
        <RivePlayer
          src={spec.file}
          artboard={spec.artboard}
          values={values}
          onReady={() => setLoaded(true)}
          onFail={() => {
            setLoaded(false)
            setFailed(true)
          }}
        />
      )}
    </div>
  )
}
