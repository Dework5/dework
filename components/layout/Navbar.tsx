'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown } from 'lucide-react'

const publications = [
  { slug: 'san-diego-la-revista', name: 'San Diego La Revista' },
  { slug: 'haras-del-pilar', name: 'Haras del Pilar' },
  { slug: 'pilara-magazine', name: 'Pilará Magazine' },
  { slug: 'los-lagartos', name: 'Los Lagartos' },
  { slug: 'campo-chico', name: 'Campo Chico' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/90 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-content mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1 group">
          <span className="text-primary text-xl font-bold">•</span>
          <span className="font-display font-bold text-xl text-text-primary tracking-wider group-hover:text-white transition-colors">
            DEWORK
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {/* Revistas dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors font-body text-sm tracking-wide">
              Revistas
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-surface border border-border rounded-sm shadow-2xl py-1">
                {publications.map((pub) => (
                  <Link
                    key={pub.slug}
                    href={`/revistas/${pub.slug}`}
                    className="block px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors font-body"
                  >
                    {pub.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/anunciantes"
            className="text-text-secondary hover:text-text-primary transition-colors font-body text-sm tracking-wide"
          >
            Anunciantes
          </Link>
          <a
            href="/#contacto"
            className="text-text-secondary hover:text-text-primary transition-colors font-body text-sm tracking-wide"
          >
            Contacto
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-text-primary p-2 min-h-[48px] min-w-[48px] flex items-center justify-center"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menú"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile fullscreen menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/95 z-40 flex flex-col pt-20 px-8">
          <button
            className="absolute top-4 right-4 p-3 text-text-secondary"
            onClick={() => setMenuOpen(false)}
          >
            <X size={24} />
          </button>
          <Link
            href="/revistas/san-diego-la-revista"
            className="py-4 text-lg text-text-primary border-b border-border font-body"
            onClick={() => setMenuOpen(false)}
          >
            San Diego La Revista
          </Link>
          {publications.slice(1).map((pub) => (
            <Link
              key={pub.slug}
              href={`/revistas/${pub.slug}`}
              className="py-4 text-base text-text-secondary border-b border-border font-body"
              onClick={() => setMenuOpen(false)}
            >
              {pub.name}
            </Link>
          ))}
          <Link
            href="/anunciantes"
            className="py-4 text-lg text-text-primary border-b border-border font-body"
            onClick={() => setMenuOpen(false)}
          >
            Anunciantes
          </Link>
          <a
            href="/#contacto"
            className="py-4 text-lg text-text-primary font-body"
            onClick={() => setMenuOpen(false)}
          >
            Contacto
          </a>
        </div>
      )}
    </nav>
  )
}
