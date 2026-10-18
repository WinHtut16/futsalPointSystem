import { Tilt_Neon } from 'next/font/google'

// ACJ Gaming's sign face: Tilt Neon is drawn as bent glass tubes, the way a
// real neon sign is built. Imported only by the /games route, so the rest of
// the park never downloads it. Latin only; Burmese headings fall back to the
// park's Burmese display face (see .arc-font in park.css).
const tiltNeon = Tilt_Neon({
  subsets: ['latin'],
  variable: '--font-arcade',
  display: 'swap',
})

export const arcadeFontVar = tiltNeon.variable
