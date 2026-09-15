import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'

// Admin-suite type stack — same faces as Billiards and Game. Imported only by
// the three admin-facing layouts ((admin), (auth)/admin, (portal)), so
// customer-facing routes ((site), (customer), (auth) login/register) never
// preload or download these files. See DESIGN.md.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const plexFontVars = `${plexSans.variable} ${plexMono.variable}`
