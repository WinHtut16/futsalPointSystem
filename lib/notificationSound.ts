function makeAudioContext() {
  const AudioContextClass =
    typeof window !== 'undefined'
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined
  return AudioContextClass ? new AudioContextClass() : null
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  peakGain: number
) {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startTime)
  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.05)
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration)
}

/**
 * Redemption request alert: high → low (880 Hz then 660 Hz).
 * Silently swallows NotAllowedError and any other errors.
 */
export function playNotificationBeep(): void {
  const ctx = makeAudioContext()
  if (!ctx) return
  ctx.resume().then(() => {
    try {
      const now = ctx.currentTime
      playTone(ctx, 880, now, 0.2, 0.3)
      playTone(ctx, 660, now + 0.08, 0.2, 0.2)
      setTimeout(() => ctx.close().catch(() => {}), 600)
    } catch {
      // Silently swallow scheduling errors
    }
  }).catch(() => {
    // resume() blocked — silent fail
  })
}

/**
 * New booking alert: low → high (660 Hz then 880 Hz) — ascending, distinct from redemption.
 * Silently swallows NotAllowedError and any other errors.
 */
export function playBookingBeep(): void {
  const ctx = makeAudioContext()
  if (!ctx) return
  ctx.resume().then(() => {
    try {
      const now = ctx.currentTime
      playTone(ctx, 660, now, 0.2, 0.3)
      playTone(ctx, 880, now + 0.08, 0.2, 0.2)
      setTimeout(() => ctx.close().catch(() => {}), 600)
    } catch {
      // Silently swallow scheduling errors
    }
  }).catch(() => {
    // resume() blocked — silent fail
  })
}
