'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import Link from 'next/link'

export function HeroSection({ issue }: { issue: any }) {
  const issueNumber = issue?.issue_number || issue?.issueNumber || 139
  const slug = issue?.publication_slug || issue?.slug || 'san-diego-la-revista'
  const coverUrl = issue?.cover_url || null

  return (
    <section
      className="relative flex flex-col justify-center md:justify-start bg-dw-black overflow-hidden"
      style={{ minHeight: '100svh' }}
    >

      {/* Ambient radial background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 90% 70% at 65% 35%, #111 0%, #080808 75%)' }} />

      {/* Giant issue-number watermark */}
      <div aria-hidden className="absolute right-[-4vw] top-1/2 -translate-y-1/2 select-none pointer-events-none leading-none hidden lg:block">
        <span className="font-display font-bold italic"
          style={{ fontSize: 'clamp(260px, 34vw, 480px)', color: 'transparent', WebkitTextStroke: '1px #161616' }}>
          {issueNumber}
        </span>
      </div>

      {/* Desktop spacer — pushes content to bottom on large screens */}
      <div className="hidden md:block md:flex-1 md:min-h-[11rem]" aria-hidden />

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-16 pt-24 pb-12 md:pt-0 md:pb-20">

        <div className="grid md:grid-cols-[1fr_220px] gap-12 items-end">

          {/* LEFT */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-6 md:mb-10">
              <span className="w-5 h-px bg-dw-border" />
              <span className="text-dw-muted text-[10px] tracking-[0.28em] uppercase">
                Dework · Agencia Editorial · Pilar, Buenos Aires
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
              className="font-display font-bold text-dw-white leading-[0.9] tracking-tight mb-6"
              style={{ fontSize: 'clamp(52px, 7.5vw, 96px)' }}>
              Revistas<br />
              <em className="font-display italic font-normal text-dw-sub"
                style={{ fontSize: '0.6em' }}>zona norte / oeste</em>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28, duration: 0.7 }}
              className="text-dw-sub text-sm leading-[1.75] max-w-[400px] mb-7 md:mb-10">
              Diseñamos y publicamos las revistas de San Diego, Pilar y zona norte de Buenos Aires.
              Más de 11 años y 201 ediciones en circulación.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-wrap items-center gap-5">
              <Link href="/#publicaciones"
                className="bg-dw-white text-dw-black text-[11px] tracking-[0.18em] uppercase px-8 py-4 font-semibold hover:bg-dw-text transition-colors duration-200">
                VER PUBLICACIONES →
              </Link>
              <Link href={`/revistas/${slug}/${issueNumber}`}
                className="text-dw-sub text-[11px] tracking-[0.18em] uppercase hover:text-dw-white transition-colors border-b border-dw-border pb-px">
                ÚLTIMA EDICIÓN #{issueNumber}
              </Link>
            </motion.div>
          </div>

          {/* RIGHT — current issue mini-card */}
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.22, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="hidden md:block self-end">
            <Link href={`/revistas/${slug}/${issueNumber}`} className="block group">
              <div className="aspect-[3/4] bg-dw-surface border border-dw-border relative overflow-hidden mb-4 group-hover:border-dw-sub transition-colors duration-300">
                {coverUrl ? (
                  <>
                    <Image
                      src={coverUrl}
                      alt={`San Diego La Revista #${issueNumber}`}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="220px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="font-display italic text-white/50 text-5xl leading-none mb-1.5 group-hover:text-white/75 transition-colors">
                        #{issueNumber}
                      </p>
                      <p className="text-white/50 text-[9px] tracking-widest uppercase">Edición actual</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0"
                      style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #111 0,#111 1px,transparent 0,transparent 14px)' }} />
                    <div className="absolute inset-0 flex flex-col justify-between p-5">
                      <span className="text-dw-muted text-[9px] tracking-[0.25em] uppercase">San Diego</span>
                      <div>
                        <p className="font-display italic text-dw-border text-5xl leading-none mb-1.5 group-hover:text-dw-muted transition-colors">
                          #{issueNumber}
                        </p>
                        <p className="text-dw-muted text-[9px] tracking-widest uppercase">Edición actual</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <p className="text-dw-muted text-[10px] tracking-[0.2em] uppercase group-hover:text-dw-sub transition-colors">
                Leer ahora →
              </p>
            </Link>
          </motion.div>

        </div>

        {/* Bottom rule */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 md:mt-14 h-px bg-dw-border origin-left" />
      </div>
    </section>
  )
}
