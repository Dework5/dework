'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, motion } from 'framer-motion'

function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref as any, { once: true, margin: '-60px' })
  useEffect(() => {
    if (!inView) return
    let v = 0; const step = end / 90
    const t = setInterval(() => { v = Math.min(v + step, end); setN(Math.floor(v)); if (v >= end) clearInterval(t) }, 16)
    return () => clearInterval(t)
  }, [inView, end])
  return <span ref={ref}>{n.toLocaleString('es-AR')}{suffix}</span>
}

const STATS = [
  {
    end: 201, suffix: '+',
    label: 'EDICIONES PUBLICADAS',
    sub: 'En circulación desde 2014',
    italic: false,
  },
  {
    end: 10000, suffix: '+',
    label: 'LECTORES MENSUALES',
    sub: 'En San Diego, Pilar y zona norte',
    italic: false,
  },
  {
    end: 11, suffix: '',
    label: 'AÑOS PUBLICANDO',
    sub: 'Sin parar, mes a mes',
    italic: true,
  },
]

export function StatsSection() {
  return (
    <section className="bg-[#16362B] py-12 md:py-24 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="mb-8 md:mb-16">
          <div className="flex items-baseline gap-4 mb-3">
            <span className="text-[#D9C29A] text-[10px] tracking-[0.3em] uppercase">03 /</span>
            <h2 className="font-display text-4xl md:text-5xl text-[#F4EFE4] font-normal">En números</h2>
          </div>
          <p className="text-[#EAE2CF]/75 text-sm max-w-md leading-relaxed">
            Más de una década construyendo las revistas de referencia de zona norte.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#B08D57]/40 border border-[#B08D57]/50">
          {STATS.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.1 }}
              className="px-6 py-10 md:px-10 md:py-16">
              <div
                className={`font-display text-[#F4EFE4] leading-none mb-3 ${s.italic ? 'italic' : ''}`}
                style={{ fontSize: 'clamp(52px, 6vw, 80px)' }}>
                <Counter end={s.end} />{s.suffix}
                {s.italic && (
                  <span className="ml-2 text-[0.45em] not-italic text-[#D9C29A] tracking-wider align-middle">años</span>
                )}
              </div>
              <p className="text-[#D9C29A] text-[11px] tracking-[0.18em] uppercase mb-2">{s.label}</p>
              <p className="text-[#EAE2CF]/70 text-xs">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
