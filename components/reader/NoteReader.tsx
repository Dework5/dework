'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { Bodoni_Moda, Libre_Caslon_Text } from 'next/font/google'
import type { Nota } from '@/lib/types'

const bodoni = Bodoni_Moda({ subsets: ['latin'], weight: ['400', '500'], style: ['normal', 'italic'], display: 'swap' })
const caslon = Libre_Caslon_Text({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap' })

const VERDE = '#16362B', CREMA = '#F4EFE4', ORO = '#B08D57'

interface Props {
  nota: Nota
  siguiente?: Nota | null
  onClose: () => void
  onAbrir: (n: Nota) => void
}

// Modo lectura: la nota con letra de celular, sus fotos y el estilo de la revista.
export default function NoteReader({ nota, siguiente, onClose, onAbrir }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [avance, setAvance] = useState(0)

  // Bloquear el scroll de atrás, cerrar con Escape y volver arriba al cambiar de nota
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); setAvance(0) }, [nota.id])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    setAvance(max > 0 ? el.scrollTop / max : 0)
  }

  const esLista = nota.cuerpo.every(b => typeof b !== 'string')
  const minutos = Math.max(1, Math.round(nota.cuerpo.reduce((a, b) => a + (typeof b === 'string' ? b.split(/\s+/).length : 0), 0) / 200))
  let primerParrafo = true

  return (
    <div className={`${caslon.className} fixed inset-0 z-50 flex flex-col`} style={{ background: CREMA, color: '#23251f' }} role="dialog" aria-modal="true" aria-label={nota.titulo}>
      {/* Barra superior: progreso de lectura + cerrar */}
      <div className="flex-shrink-0 relative" style={{ background: VERDE }}>
        <div className="h-12 flex items-center justify-between px-4" style={{ color: CREMA }}>
          <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: '#D9C29A' }}>{nota.seccion ?? 'San Diego La Revista'}</span>
          <button onClick={onClose} aria-label="Volver a la revista" className="flex items-center gap-1.5 text-[11px] tracking-[0.15em] uppercase">
            Revista <X size={18} />
          </button>
        </div>
        <div className="absolute left-0 bottom-0 h-[2px]" style={{ width: `${avance * 100}%`, background: ORO, transition: 'width .1s linear' }} />
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain">
        {nota.foto && (
          <img src={nota.foto} alt="" className="w-full block object-cover" style={{ maxHeight: '62vh' }} />
        )}
        <article className="mx-auto px-6 pt-8 pb-16" style={{ maxWidth: 640 }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] tracking-[0.32em] uppercase" style={{ color: ORO }}>{nota.seccion ?? ''}</span>
            <span className="h-px w-10" style={{ background: ORO }} />
            {!esLista && <span className="text-[10px] tracking-[0.2em] uppercase text-black/40">{minutos} min de lectura</span>}
          </div>
          <h1 className={bodoni.className} style={{ color: VERDE, fontSize: 'clamp(32px, 8.5vw, 46px)', lineHeight: 1.04, fontWeight: 400 }}>
            {nota.titulo}{nota.tituloCursiva && <> <i style={{ color: ORO }}>{nota.tituloCursiva}</i></>}
          </h1>
          {nota.bajada && (
            <p className="mt-5 italic" style={{ color: VERDE, fontSize: 19, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{nota.bajada}</p>
          )}
          <div className={`${bodoni.className} text-center my-7 tracking-[0.8em]`} style={{ color: ORO }}>✦ ✦ ✦</div>

          <div style={{ fontSize: 18, lineHeight: 1.68 }}>
            {nota.cuerpo.map((b, i) => {
              if (typeof b === 'string') {
                const capital = primerParrafo
                primerParrafo = false
                return (
                  <p key={i} className={capital ? 'nota-capital' : ''} style={{ marginTop: i === 0 ? 0 : '0.9em' }} dangerouslySetInnerHTML={{ __html: b }} />
                )
              }
              if ('h' in b) return <h2 key={i} className={`${bodoni.className} italic`} style={{ color: ORO, fontSize: 26, lineHeight: 1.15, margin: '1.6em 0 0.4em' }}>{b.h}</h2>
              if ('li' in b) return <p key={i} style={{ marginTop: '0.7em', paddingLeft: 20, position: 'relative' }}><span style={{ position: 'absolute', left: 0, color: ORO, fontSize: 12, top: 4 }}>✦</span><span dangerouslySetInnerHTML={{ __html: b.li }} /></p>
              if ('foto' in b) return (
                <figure key={i} style={{ margin: '1.8em -24px' }}>
                  <img src={b.foto} alt={b.pie ?? ''} loading="lazy" className="w-full block" />
                  {b.pie && <figcaption className="italic text-[13px] text-black/55 px-6 mt-2">{b.pie}</figcaption>}
                </figure>
              )
              if ('cita' in b) return (
                <blockquote key={i} className={`${bodoni.className} italic text-center`} style={{ color: VERDE, fontSize: 24, lineHeight: 1.3, borderTop: `1px solid ${ORO}`, borderBottom: `1px solid ${ORO}`, padding: '0.9em 0.4em', margin: '1.6em 0' }}>“{b.cita}”</blockquote>
              )
              if ('firma' in b) return <p key={i} className="italic text-right" style={{ marginTop: '1.4em' }}>{b.firma}</p>
              if ('servicio' in b) {
                // Ficha de la guía de servicios: texto tal cual; el teléfono se puede tocar para llamar
                const tel = b.servicio.map(l => l.replace(/<[^>]+>/g, '')).find(l => /\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/.test(l))
                const numero = tel?.match(/[\d\s-]{8,}/)?.[0].replace(/\D/g, '')
                return (
                  <div key={i} className="flex items-center gap-4" style={{ margin: '0.9em 0', padding: '14px 16px', background: '#FBF8F2', border: `1px solid ${ORO}55`, fontSize: 16, lineHeight: 1.45 }}>
                    <div className="flex-1">
                      {b.servicio.map((l, k) => <div key={k} className={k === 0 ? `${bodoni.className}` : ''} style={k === 0 ? { color: VERDE, fontSize: 19 } : undefined} dangerouslySetInnerHTML={{ __html: l }} />)}
                    </div>
                    {numero && (
                      <a href={`tel:${numero}`} className="flex-shrink-0 rounded-full text-[10px] tracking-[0.18em] uppercase" style={{ background: VERDE, color: CREMA, padding: '8px 14px' }}>Llamar</a>
                    )}
                  </div>
                )
              }
              return null
            })}
          </div>

          {/* Cierre: seguir leyendo */}
          <div className="mt-12 pt-6" style={{ borderTop: `1px solid ${ORO}` }}>
            {siguiente && (
              <button onClick={() => onAbrir(siguiente)} className="w-full text-left rounded-sm p-5 flex items-center gap-4" style={{ background: VERDE, color: CREMA }}>
                <div className="flex-1">
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-1.5" style={{ color: '#D9C29A' }}>Siguiente nota</div>
                  <div className={bodoni.className} style={{ fontSize: 22, lineHeight: 1.15 }}>{siguiente.titulo}{siguiente.tituloCursiva ? ` ${siguiente.tituloCursiva}` : ''}</div>
                </div>
                <ArrowRight size={22} style={{ color: '#D9C29A' }} />
              </button>
            )}
            <button onClick={onClose} className="w-full mt-4 py-3 text-[11px] tracking-[0.25em] uppercase" style={{ color: VERDE, border: `1px solid ${VERDE}` }}>
              Volver a la revista
            </button>
          </div>
        </article>
      </div>

      <style>{`
        .nota-capital::first-letter{float:left;font-family:${bodoni.style.fontFamily};font-size:4.1em;line-height:.82;color:${ORO};margin:.06em .1em 0 0}
        .${caslon.className} b{font-weight:700;color:${VERDE}}
      `}</style>
    </div>
  )
}
