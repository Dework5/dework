'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  secciones: [string, string][]
}

// Botón "Secciones" pegado debajo del menú de arriba: al tocarlo despliega los accesos a cada parte de la página.
export function SeccionesMenu({ secciones }: Props) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', esc) }
  }, [abierto])

  return (
    <div ref={ref} className="fixed top-24 md:top-28 right-4 md:right-10 z-40">
      <button
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        className="flex items-center gap-2 bg-[#16362B] text-[#EAE2CF] text-[10px] md:text-[11px] tracking-[0.22em] uppercase pl-4 pr-3 py-2.5 rounded-b-xl shadow-[0_6px_18px_rgba(15,42,32,0.28)] hover:text-[#D9C29A] transition-colors"
      >
        Secciones
        <ChevronDown size={14} className={`transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <nav aria-label="Secciones" className="absolute right-0 mt-2 w-60 bg-[#16362B] border border-[#B08D57]/50 shadow-[0_12px_32px_rgba(15,42,32,0.35)] py-2">
          {secciones.map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => setAbierto(false)}
              className="block px-5 py-3 font-display text-[#F4EFE4] text-[17px] hover:bg-[#B08D57]/15 hover:text-[#D9C29A] transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}
