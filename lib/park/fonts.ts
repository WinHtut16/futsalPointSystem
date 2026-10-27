import { Archivo } from 'next/font/google'

// Park showcase type: one family, Archivo, with its width axis. Headings run
// wide and heavy like park signage and the depth numbers painted on the pool
// deck; body text sits at normal width. Imported only by app/(park)/layout.tsx,
// so the futsal booking site and the admin suite never download it.
//
// Burmese uses Noto Sans Myanmar, already loaded by the root layout as
// --font-noto-my; park.css points the display stack at it in bold.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-park-body',
  display: 'swap',
})

export const parkFontVars = archivo.variable
