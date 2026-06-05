import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Sora, Manrope, JetBrains_Mono, Noto_Sans_Myanmar } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import type { Language } from '@/lib/i18n'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' })
const notoMy = Noto_Sans_Myanmar({
  subsets: ['myanmar'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-my',
  display: 'swap',
})

const fontVars = `${sora.variable} ${manrope.variable} ${jetbrains.variable} ${notoMy.variable}`

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
    <html lang={lang} data-lang={lang} className={fontVars}>
      <body className="bg-gray-50 text-gray-900 antialiased font-body">
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  )
}
