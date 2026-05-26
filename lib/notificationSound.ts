/**
 * Plays a short two-tone beep via the Web Audio API.
 * Silently swallows NotAllowedError (browser autoplay block) and any other errors.
 */
export function playNotificationBeep(): void {
  try {
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        : undefined
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()

    const playTone = (
      frequency: number,
      startTime: number,
      duration: number,
      peakGain: number
    ) => {
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

    const now = ctx.currentTime
    playTone(880, now, 0.2, 0.3)        // high tone
    playTone(660, now + 0.08, 0.2, 0.2) // lower tone, slight delay

    // Release AudioContext after sounds finish
    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch {
    // Silently swallow NotAllowedError (autoplay block) and any other errors
  }
}
