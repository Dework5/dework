'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

// The reader page (/revistas/slug/numero) has its own fullscreen layout with a
// custom top bar — it must NOT render the global Navbar or Footer.
const READER_RE = /^\/revistas\/[^/]+\/\d/

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const isAdmin  = pathname.startsWith('/admin')
  const isReader = READER_RE.test(pathname)
  const showChrome = !isAdmin && !isReader

  return (
    <>
      {showChrome && <Navbar />}
      {children}
      {showChrome && <Footer />}
    </>
  )
}
