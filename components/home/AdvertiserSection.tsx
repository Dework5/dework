'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export function AdvertiserSection() {
  return (
    <section className="bg-dw-black py-28 px-6 md:px-10 border-t border-dw-border">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <p className="text-dw-muted text-[10px] tracking-[0.3em] uppercase mb-5">03 / Para anunciantes</p>
          <h2 className="font-display font-bold text-dw-white leading-tight mb-8"
            style={{ fontSize: 'clamp(36px, 4.5vw, 56px)' }}>
            Tu marca frente a miles de lectores reales
          </h2>
          <p className="text-dw-muted text-[15px] leading-relaxed mb-12 max-w-sm">
            San Diego La Revista llega mes a mes a zona norte de Buenos Aires. Audiencia local, calificada y medible.
          </p>
          <Link href="/anunciantes"
            className="bg-dw-white text-dw-black text-[11px] font-semibold tracking-[0.12em] uppercase px-9 py-4 hover:bg-dw-text transition-colors duration-200 inline-block">
            Quiero pautar →
          </Link>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="flex flex-col border border-dw-border divide-y divide-dw-border">
          {[
            { val: '+10.000',    label: 'Lectores únicos por edición'       },
            { val: '4:30 min',   label: 'Tiempo promedio de lectura'         },
            { val: 'Zona Norte', label: 'Audiencia 100% local y calificada'  },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-8 bg-dw-card hover:bg-dw-surface transition-colors duration-200 px-8 py-6 group">
              <span className="font-display text-dw-white font-bold text-2xl min-w-[130px]">{m.val}</span>
              <span className="text-dw-muted text-sm group-hover:text-dw-sub transition-colors">{m.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
