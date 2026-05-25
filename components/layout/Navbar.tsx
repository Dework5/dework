'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

const LINKS = [
  { label: 'Revistas', href: '/#publicaciones' },
  { label: 'Contacto', href: '/#contacto'      },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <>
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled ? 'bg-dw-black/90 backdrop-blur-md border-b border-dw-border' : ''
      }`}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/logo-dework.png" alt="Dework" width={110} height={36} className="object-contain" priority />
          </Link>
          <div className="hidden md:flex items-center gap-10">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href}
                className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text transition-colors duration-200">
                {l.label}
              </Link>
            ))}
          </div>
          <button className="md:hidden text-dw-muted hover:text-dw-text p-2" onClick={() => setMenuOpen(v => !v)} aria-label="Menú">
            <span className="block w-5 h-px bg-current mb-1.5 transition-all duration-300"
              style={menuOpen ? { transform: 'rotate(45deg) translate(1px, 8px)' } : {}} />
            <span className="block w-5 h-px bg-current mb-1.5 transition-all duration-300"
              style={menuOpen ? { opacity: 0 } : {}} />
            <span className="block w-5 h-px bg-current transition-all duration-300"
              style={menuOpen ? { transform: 'rotate(-45deg) translate(1px, -8px)' } : {}} />
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-dw-black flex flex-col items-center justify-center gap-10">
            {LINKS.map((l, i) => (
              <motion.div key={l.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }}>
                <Link href={l.href} onClick={() => setMenuOpen(false)}
                  className="font-display text-5xl text-dw-white hover:text-dw-sub transition-colors italic">
                  {l.label}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
