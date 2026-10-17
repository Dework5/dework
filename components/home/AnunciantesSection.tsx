'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import type { Aviso } from '@/lib/types'

interface Props {
  avisos: Aviso[]
  slug: string
  numero: number
  mes?: string
  /** Número de sección para el encabezado ("02 /"); sin número en la página de la revista */
  orden?: string
}

// Banners con los avisos de la edición: tarjeta con marco dorado; al tocar se ve en grande.
export function AnunciantesSection({ avisos, slug, numero, mes, orden }: Props) {
  const [abierto, setAbierto] = useState<Aviso | null>(null)

  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto])

  if (!avisos.length) return null

  return (
    <section id="anunciantes" className="bg-dw-surface py-14 md:py-24 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-12">
          <div className="flex items-baseline gap-4 mb-3">
            {orden && <span className="text-dw-gold text-[10px] tracking-[0.3em] uppercase">{orden} /</span>}
            <h2 className="font-display text-4xl md:text-5xl text-dw-white font-normal">Anunciantes</h2>
          </div>
          <p className="text-dw-sub text-sm max-w-lg leading-relaxed">
            Las marcas que acompañan a San Diego La Revista{mes ? <> en <i className="font-display text-dw-gold">{mes}</i></> : ''}.
          </p>
        </div>

        {/* En el celular se desliza de costado; en la compu, grilla */}
        <div className="flex md:grid md:grid-cols-4 lg:grid-cols-7 gap-5 md:gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-3 -mx-5 px-5 md:mx-0 md:px-0" style={{ scrollbarWidth: 'none' }}>
          {avisos.map(a => (
            <button key={`${a.pagina}-${a.marca}`} onClick={() => setAbierto(a)} className="group text-left flex-shrink-0 w-[44vw] sm:w-[30vw] md:w-auto snap-start">
              <div className={`aspect-[210/297] relative ${a.formato === 'media' ? 'bg-[#16362B]' : 'bg-dw-card'} outline outline-1 outline-dw-gold/70 outline-offset-4 shadow-[0_8px_26px_rgba(31,42,36,0.14)] group-hover:shadow-[0_12px_34px_rgba(31,42,36,0.24)] transition-shadow duration-300 overflow-hidden`}>
                <img src={a.imagen} alt={`Aviso de ${a.marca}`} loading="lazy" className={`absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-[1.03] ${a.formato === 'media' ? 'object-contain p-2' : 'object-cover'}`} />
              </div>
              <p className="font-display text-dw-white text-[15px] leading-tight mt-4">{a.marca}</p>
              <p className="text-dw-gold text-[9px] tracking-[0.25em] uppercase mt-1">Ver aviso</p>
            </button>
          ))}
        </div>
      </div>

      {/* Aviso en grande */}
      {abierto && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4" style={{ background: 'rgba(15,42,32,.92)' }} onClick={() => setAbierto(null)}>
          <button className="absolute top-4 right-4 text-[#F4EFE4] p-2" aria-label="Cerrar" onClick={() => setAbierto(null)}><X size={24} /></button>
          <img src={abierto.imagen.replace(/-800\.webp$/, '-1600.webp')} alt={`Aviso de ${abierto.marca}`}
            className="max-h-[78dvh] max-w-full object-contain shadow-2xl" style={{ outline: '1px solid #B08D57', outlineOffset: 6 }}
            onClick={e => e.stopPropagation()} />
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6" onClick={e => e.stopPropagation()}>
            <span className="font-display text-[#F4EFE4] text-lg mr-2">{abierto.marca}</span>
            {abierto.url && (
              <a href={abierto.url} target="_blank" rel="noopener noreferrer" className="text-[10px] tracking-[0.22em] uppercase px-5 py-2.5" style={{ background: '#B08D57', color: '#F4EFE4' }}>
                Contactar
              </a>
            )}
            <Link href={`/revistas/${slug}/${numero}?p=${abierto.pagina}`} className="text-[10px] tracking-[0.22em] uppercase px-5 py-2.5" style={{ border: '1px solid #D9C29A', color: '#F4EFE4' }}>
              Ver en la revista
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
