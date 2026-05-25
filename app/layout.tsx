import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { SiteShell } from '@/components/layout/SiteShell'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Dework Editorial — Revistas digitales de zona norte',
  description: 'Revistas editoriales de San Diego y zona norte de Buenos Aires. Más de 139 ediciones publicadas.',
  keywords: 'revistas, san diego, pilar, zona norte, editorial, dework',
  openGraph: {
    title: 'Dework Editorial',
    description: 'Revistas digitales de zona norte de Buenos Aires',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-body bg-dw-black text-dw-text antialiased">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  )
}
