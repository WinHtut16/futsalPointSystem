// Pointer tilt shared by the landing's LivePhoto and the /games library
// cards. Writes four CSS variables on the tilted element
//   {prefix}-rx / -ry : rotation toward the pointer (deg)
//   {prefix}-mx / -my : pointer position inside it (%), for a light/sheen
// and toggles `is-tilting` on it; the look lives in park.css. One pointer
// listener per root, at most one style write per frame. Mouse/trackpad only
// (hover-capable, fine pointer) and never under reduced motion: callers get
// a no-op cleanup otherwise.

export type TiltOptions = {
  /** CSS variable prefix, e.g. '--lp'. */
  prefix: string
  /** Max rotation around X / Y in degrees. */
  rx: number
  ry: number
  /**
   * Which element under the pointer to tilt. Omit to tilt the root itself;
   * pass e.g. (t) => t.closest('.gl-card') to tilt items inside one root.
   */
  target?: (from: Element) => HTMLElement | null
}

export function canTilt(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function attachTilt(root: HTMLElement, { prefix, rx, ry, target }: TiltOptions): () => void {
  if (!canTilt()) return () => {}
  let frame = 0
  let last: PointerEvent | null = null
  let current: HTMLElement | null = null

  const reset = (el: HTMLElement | null) => {
    if (!el) return
    el.classList.remove('is-tilting')
    el.style.setProperty(`${prefix}-rx`, '0deg')
    el.style.setProperty(`${prefix}-ry`, '0deg')
  }

  const apply = () => {
    frame = 0
    if (!last) return
    const el = target ? target(last.target as Element) : root
    if (el !== current) {
      reset(current)
      current = el
    }
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (last.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (last.clientY - r.top) / r.height))
    el.classList.add('is-tilting')
    el.style.setProperty(`${prefix}-rx`, `${((0.5 - y) * rx).toFixed(2)}deg`)
    el.style.setProperty(`${prefix}-ry`, `${((x - 0.5) * ry).toFixed(2)}deg`)
    el.style.setProperty(`${prefix}-mx`, `${(x * 100).toFixed(1)}%`)
    el.style.setProperty(`${prefix}-my`, `${(y * 100).toFixed(1)}%`)
  }

  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
    last = e
    if (!frame) frame = requestAnimationFrame(apply)
  }
  const leave = () => {
    last = null
    reset(current)
    current = null
  }

  root.addEventListener('pointermove', move)
  root.addEventListener('pointerleave', leave)
  return () => {
    if (frame) cancelAnimationFrame(frame)
    root.removeEventListener('pointermove', move)
    root.removeEventListener('pointerleave', leave)
    reset(current)
  }
}
