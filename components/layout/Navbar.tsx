'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useSecciones } from './seccionesStore'

const LINKS = [
  { label: 'Revistas', href: '/#publicaciones' },
  { label: 'Contacto', href: '/#contacto'      },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // Secciones de la página (las declara cada página): en la compu, desplegable en la barra; en el celular, dentro del menú ☰
  const secciones = useSecciones()
  const [secAbierto, setSecAbierto] = useState(false)
  const secRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!secAbierto) return
    const fuera = (e: MouseEvent) => { if (!secRef.current?.contains(e.target as Node)) setSecAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSecAbierto(false) }
    document.addEventListener('mousedown', fuera)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', esc) }
  }, [secAbierto])
  const enMenu = secciones.length ? [...secciones.filter(([h]) => h !== '/#contacto').map(([href, label]) => ({ href, label })), LINKS[1]] : LINKS

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-[#16362B] shadow-[0_2px_18px_rgba(15,42,32,0.25)]">
        {/* Logo centrado; en la compu "Revistas" a la izquierda y "Contacto" a la derecha */}
        <div className="relative max-w-7xl mx-auto px-6 md:px-10 h-24 md:h-28 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="hidden md:flex justify-start">
            {secciones.length ? (
              <div ref={secRef} className="relative">
                <button onClick={() => setSecAbierto(a => !a)} aria-expanded={secAbierto}
                  className="flex items-center gap-2 text-[#EAE2CF] text-[12px] tracking-[0.22em] uppercase hover:text-[#D9C29A] transition-colors duration-200">
                  Secciones <ChevronDown size={14} className={`transition-transform duration-200 ${secAbierto ? 'rotate-180' : ''}`} />
                </button>
                {secAbierto && (
                  <div className="absolute left-0 top-full mt-5 w-64 bg-[#16362B] border border-[#B08D57]/50 shadow-[0_12px_32px_rgba(15,42,32,0.35)] py-2">
                    {secciones.map(([href, label]) => (
                      <a key={href} href={href} onClick={() => setSecAbierto(false)}
                        className="block px-5 py-3 font-display text-[#F4EFE4] text-[17px] hover:bg-[#B08D57]/15 hover:text-[#D9C29A] transition-colors">
                        {label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link href={LINKS[0].href} className="text-[#EAE2CF] text-[12px] tracking-[0.22em] uppercase hover:text-[#D9C29A] transition-colors duration-200">
                {LINKS[0].label}
              </Link>
            )}
          </div>
          <Link href="/" className="col-start-2 flex flex-col items-center justify-center">
            <Image src="/logo-dework-recorte.png" alt="Dework" width={600} height={153} className="h-9 md:h-12 w-auto object-contain" priority unoptimized />
            <span className="mt-1.5 md:mt-2 text-[#D9C29A] text-[8.5px] md:text-[10px] tracking-[0.42em] uppercase pl-[0.42em]">Agencia Gráfica</span>
          </Link>
          <div className="hidden md:flex justify-end">
            <Link href={LINKS[1].href} className="text-[#EAE2CF] text-[12px] tracking-[0.22em] uppercase hover:text-[#D9C29A] transition-colors duration-200">
              {LINKS[1].label}
            </Link>
          </div>
          <button className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 text-[#EAE2CF] hover:text-[#D9C29A] p-2" onClick={() => setMenuOpen(v => !v)} aria-label="Menú">
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
            className={`fixed inset-0 z-40 bg-dw-black flex flex-col items-center justify-center ${enMenu.length > 3 ? 'gap-7' : 'gap-10'}`}>
            {enMenu.map((l, i) => (
              <motion.div key={l.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }}>
                <Link href={l.href} onClick={() => setMenuOpen(false)}
                  className={`font-display ${enMenu.length > 3 ? 'text-3xl' : 'text-5xl'} text-dw-white hover:text-dw-sub transition-colors italic`}>
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
