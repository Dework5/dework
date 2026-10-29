import type { Metadata } from 'next'
import { Bodoni_Moda, Libre_Caslon_Text } from 'next/font/google'
import './globals.css'
import { SiteShell } from '@/components/layout/SiteShell'

// Misma tipografía que la revista (diseño "Club")
const caslon = Libre_Caslon_Text({
  subsets: ['latin'],
  variable: '--font-caslon',
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  // las imágenes para compartir (WhatsApp) ahora están en el propio sitio: links completos
  metadataBase: new URL('https://www.dework.com.ar'),
  title: 'Dework · Agencia Digital — Revistas de clubes y countries',
  description: 'Diseñamos, editamos y publicamos las revistas de San Diego Country Club, Olivos Golf Club, Haras del Pilar, Pilará, Los Lagartos y Campo Chico. Más de 201 ediciones publicadas.',
  keywords: 'revistas, san diego, pilar, countries, clubes, editorial, dework, agencia digital',
  openGraph: {
    title: 'Dework Editorial',
    description: 'Revistas de clubes y countries',
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
