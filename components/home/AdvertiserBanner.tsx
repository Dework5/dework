'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'

function CountUp({ end, suffix = '' }: { end: number; suffix?: string }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const duration = 2000
    const step = end / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [isInView, end])

  return (
    <span ref={ref}>
      {count.toLocaleString('es-AR')}
      {suffix}
    </span>
  )
}

export function AdvertiserBanner() {
  return (
    <section className="bg-primary py-16 md:py-24">
      <div className="max-w-content mx-auto px-4 md:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Texto izquierda */}
          <motion.div
            className="flex-1 space-y-6 text-center lg:text-left"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white leading-tight">
              Tu marca, frente a miles de lectores
            </h2>
            <p className="text-white/80 font-body text-lg leading-relaxed max-w-xl">
              San Diego La Revista llega mes a mes a toda la zona norte de Buenos Aires.
              Tu publicidad, en manos de una audiencia calificada.
            </p>
            <Link
              href="/anunciantes"
              className="inline-flex items-center gap-2 bg-white text-primary py-3 px-8 rounded-sm font-body font-medium tracking-wide hover:bg-white/90 hover:scale-[1.02] transition-all duration-200 min-h-[48px]"
            >
              Quiero pautar →
            </Link>
          </motion.div>

          {/* Stats derecha */}
          <motion.div
            className="flex-shrink-0 grid grid-cols-3 lg:grid-cols-1 gap-6 lg:gap-4 text-center lg:text-right"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="space-y-1">
              <div className="text-4xl lg:text-5xl font-display font-bold text-white">
                +<CountUp end={139} />
              </div>
              <div className="text-white/70 font-body text-sm">Ediciones publicadas</div>
            </div>
            <div className="space-y-1">
              <div className="text-4xl lg:text-5xl font-display font-bold text-white">
                +<CountUp end={10000} />
              </div>
              <div className="text-white/70 font-body text-sm">Lectores mensuales</div>
            </div>
            <div className="space-y-1">
              <div className="text-4xl lg:text-5xl font-display font-bold text-white">
                <CountUp end={5} suffix=" años" />
              </div>
              <div className="text-white/70 font-body text-sm">Publicando sin parar</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
