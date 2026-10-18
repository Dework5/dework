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
        scrolled ? 'bg-[#EAF0E6]/92 backdrop-blur-md border-b border-[#CFDCC8]' : ''
      }`}>
        {/* Logo centrado; en la compu "Revistas" a la izquierda y "Contacto" a la derecha */}
        <div className="relative max-w-7xl mx-auto px-6 md:px-10 h-24 md:h-32 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="hidden md:flex justify-start">
            <Link href={LINKS[0].href} className="text-dw-muted text-[12px] tracking-[0.22em] uppercase hover:text-dw-text transition-colors duration-200">
              {LINKS[0].label}
            </Link>
          </div>
          <Link href="/" className="col-start-2 flex items-center justify-center">
            <Image src="/logo-dework-oscuro-recorte.png" alt="Dework" width={600} height={153} className="h-12 md:h-[72px] w-auto object-contain" priority />
          </Link>
          <div className="hidden md:flex justify-end">
            <Link href={LINKS[1].href} className="text-dw-muted text-[12px] tracking-[0.22em] uppercase hover:text-dw-text transition-colors duration-200">
              {LINKS[1].label}
            </Link>
          </div>
          <button className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 text-dw-muted hover:text-dw-text p-2" onClick={() => setMenuOpen(v => !v)} aria-label="Menú">
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
