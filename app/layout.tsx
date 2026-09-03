import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Sora, Manrope, JetBrains_Mono, Noto_Sans_Myanmar, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import type { Language } from '@/lib/i18n'

// Sora/Manrope/JetBrains stay the (site) customer-booking brand — untouched.
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' })
const notoMy = Noto_Sans_Myanmar({
  subsets: ['myanmar'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-my',
  display: 'swap',
})

// Shared admin-suite type stack — same faces as Billiards and Game. Scoped
// to [data-font-scope="admin"] in globals.css: (admin), (auth)/admin,
// (portal). See DESIGN.md.
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

const fontVars = `${sora.variable} ${manrope.variable} ${jetbrains.variable} ${notoMy.variable} ${plexSans.variable} ${plexMono.variable}`

export const metadata: Metadata = {
  title: 'Mya Thida Points',
  description: 'Mya Thida Futsal loyalty points system',
  icons: { icon: '/logo_black.jpg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const lang: Language = cookieStore.get('lang')?.value === 'my' ? 'my' : 'en'
  return (
    <html lang={lang} data-lang={lang} data-app="futsal" className={fontVars}>
      <body className="bg-gray-50 text-gray-900 antialiased font-body">
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  )
}
