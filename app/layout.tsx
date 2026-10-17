import type { Metadata } from 'next'
import { Bodoni_Moda, Libre_Caslon_Text } from 'next/font/google'
import './globals.css'
import { SiteShell } from '@/components/layout/SiteShell'

// Misma tipografía que la revista (diseño "Club")
const caslon = Libre_Caslon_Text({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '700'],
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
    <html lang="es" className={`${caslon.variable} ${bodoni.variable}`}>
      <body className="font-body bg-dw-black text-dw-text antialiased">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  )
}
