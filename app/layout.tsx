import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://dework.com.ar'),
  title: {
    default: 'Dework Editorial — Revistas digitales de zona norte',
    template: '%s | Dework',
  },
  description:
    'Leé online las revistas de San Diego, Pilará y zona norte de Buenos Aires. Dework, la agencia editorial que conecta comunidades.',
  openGraph: {
    title: 'Dework Editorial',
    description: 'Revistas editoriales de zona norte de Buenos Aires.',
    url: 'https://dework.com.ar',
    siteName: 'Dework',
    locale: 'es_AR',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Dework Editorial',
      },
    ],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Dework Editorial',
  url: 'https://dework.com.ar',
  logo: 'https://dework.com.ar/logo-dework.svg',
  description:
    'Agencia de diseño editorial. Productora de revistas para comunidades de zona norte de Buenos Aires.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Pilar',
    addressRegion: 'Buenos Aires',
    addressCountry: 'AR',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+54-11-3361-6566',
    email: 'Info@dework.com.ar',
    contactType: 'customer service',
    availableLanguage: 'Spanish',
  },
  sameAs: [
    'https://www.instagram.com/dework.arg/',
    'https://www.facebook.com/dework.arg',
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="bg-background text-text-primary font-body antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
