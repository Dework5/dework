'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

export function HeroSection({ issue }: { issue: any }) {
  const issueNumber = issue?.issue_number || issue?.issueNumber || 139
  const slug = issue?.publication_slug || issue?.slug || 'san-diego-la-revista'
  const coverUrl = issue?.cover_url || issue?.coverUrl || null

  return (
    <section className="relative min-h-screen bg-dw-black flex items-center pt-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10 w-full grid lg:grid-cols-[1fr_360px] gap-12 lg:gap-20 items-center py-20">
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-dw-sub" />
            <span className="text-dw-muted text-[10px] tracking-[0.25em] uppercase">
              Edición #{issueNumber} · Disponible ahora
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="font-display font-bold text-dw-white leading-[0.9] tracking-tight"
            style={{ fontSize: 'clamp(56px, 9vw, 108px)' }}>
            San Diego
            <em className="block font-display italic font-normal text-dw-sub" style={{ fontSize: '0.65em' }}>
              La Revista
            </em>
          </motion.h1>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
            className="flex items-center gap-8 mt-14">
            <Link href={`/revistas/${slug}/${issueNumber}`}
              className="bg-dw-white text-dw-black text-[11px] font-semibold tracking-[0.12em] uppercase px-9 py-4 hover:bg-dw-text transition-colors duration-200">
              Leer ahora →
            </Link>
            <Link href="/revistas/san-diego-la-revista"
              className="text-dw-muted text-[11px] tracking-[0.12em] uppercase border-b border-dw-hover pb-px hover:text-dw-text hover:border-dw-muted transition-colors duration-200">
              Todas las ediciones
            </Link>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0, rotate: -2.5 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          whileHover={{ rotate: 0, scale: 1.03, transition: { duration: 0.5 } }}
          className="hidden lg:block relative w-full aspect-[3/4] overflow-hidden"
          style={{ boxShadow: '0 48px 120px rgba(0,0,0,0.95)' }}>
          {coverUrl ? (
            <Image src={coverUrl} alt={`Edición #${issueNumber}`} fill className="object-cover" priority />
          ) : (
            <div className="absolute inset-0 bg-dw-card flex items-end p-8"
              style={{ backgroundImage: 'repeating-linear-gradient(-55deg, #1a1a1a 0, #1a1a1a 1px, transparent 0, transparent 18px)' }}>
              <div>
                <p className="font-display italic text-dw-white/80 text-3xl leading-tight">San Diego</p>
                <p className="font-display italic text-dw-white/80 text-3xl">La Revista</p>
                <p className="text-dw-muted text-xs tracking-widest mt-3">#{issueNumber}</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        </motion.div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-dw-border" />
    </section>
  )
}
