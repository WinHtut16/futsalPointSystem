import type { Metadata, Viewport } from 'next'
import { Sora, Manrope, JetBrains_Mono, Noto_Sans_Myanmar } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body className="bg-gray-50 text-gray-900 antialiased font-body"><Providers>{children}</Providers></body>
    </html>
  )
}
