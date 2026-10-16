import { Young_Serif, Figtree, Noto_Serif_Myanmar } from 'next/font/google'

// Park showcase type stack. Imported only by app/(park)/layout.tsx, so the
// futsal booking site and the admin suite never download these files.
// Noto Sans Myanmar (body Burmese) is already loaded by the root layout as
// --font-noto-my.
const youngSerif = Young_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-park-display',
  display: 'swap',
})
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-park-body',
  display: 'swap',
})
const notoSerifMy = Noto_Serif_Myanmar({
  subsets: ['myanmar'],
  weight: ['600', '700'],
  variable: '--font-park-display-my',
  display: 'swap',
  // Only Burmese readers need it; don't make English visitors download it.
  preload: false,
})

export const parkFontVars = `${youngSerif.variable} ${figtree.variable} ${notoSerifMy.variable}`
