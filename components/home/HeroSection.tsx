'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export function HeroSection({ issue }: { issue: any }) {
  const issueNumber = issue?.issue_number || issue?.issueNumber || 139
  const slug = issue?.publication_slug || issue?.slug || 'san-diego-la-revista'

  return (
    <section className="relative min-h-screen flex flex-col justify-end pb-16 bg-dw-black overflow-hidden">

      {/* Gradient overlay — always present for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-dw-black via-dw-black/60 to-transparent pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 px-8 md:px-16 max-w-7xl mx-auto w-full">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-3 mb-8">
          <span className="w-2 h-2 rounded-full bg-dw-white animate-pulse" />
          <span className="text-dw-sub text-xs tracking-[0.3em] uppercase">
            Edición #{issueNumber} · Disponible ahora
          </span>
        </motion.div>

        {/* Title — always visible */}
        <motion.h1
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          className="font-display font-bold text-dw-white leading-[0.88] tracking-tight mb-6"
          style={{ fontSize: 'clamp(64px, 10vw, 120px)' }}>
          San Diego
          <em className="block font-display italic font-normal text-dw-text"
              style={{ fontSize: '0.62em' }}>
            La Revista
          </em>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
          className="text-dw-sub text-sm tracking-[0.2em] uppercase mb-10">
          Zona Norte de Buenos Aires
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
          className="flex items-center gap-6">
          <Link href={`/revistas/${slug}/${issueNumber}`}
            className="inline-block bg-dw-white text-dw-black text-xs tracking-[0.2em] uppercase px-8 py-4 font-semibold hover:bg-dw-text transition-colors">
            LEER AHORA →
          </Link>
          <Link href={`/revistas/${slug}`}
            className="text-dw-sub text-xs tracking-[0.2em] uppercase hover:text-dw-white transition-colors border-b border-dw-border pb-px">
            TODAS LAS EDICIONES
          </Link>
        </motion.div>

        {/* Publication name — bottom right, decorative */}
        <div className="absolute right-16 bottom-0 text-right hidden md:block">
          <p className="font-display italic text-dw-sub" style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}>
            San Diego<br />
            <span className="font-display italic text-dw-muted">La Revista</span>
          </p>
          <p className="text-dw-muted text-xs tracking-widest mt-2">#{issueNumber}</p>
        </div>

      </div>
    </section>
  )
}
