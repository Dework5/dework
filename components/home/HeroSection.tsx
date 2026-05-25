'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export function HeroSection({ issue }: { issue: any }) {
  const issueNumber = issue?.issue_number || issue?.issueNumber || 139
  const slug = issue?.publication_slug || issue?.slug || 'san-diego-la-revista'

  return (
    <section className="relative min-h-screen flex flex-col bg-dw-black overflow-hidden">

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

      {/* ── Spacer — pushes content to lower half, always respects navbar ── */}
      <div className="flex-1 min-h-[11rem]" aria-hidden />

      {/* ── Main content ── */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-8 md:px-16 pb-20">

        <div className="grid md:grid-cols-[1fr_220px] gap-12 items-end">

          {/* LEFT — brand + copy + CTAs */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-10">
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
              className="text-dw-muted text-sm leading-[1.75] max-w-[400px] mb-10">
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
              <div
                className="aspect-[3/4] bg-dw-surface border border-dw-border relative overflow-hidden mb-4 group-hover:border-dw-sub transition-colors duration-300"
                style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #111 0,#111 1px,transparent 0,transparent 14px)' }}>
                <div className="absolute inset-0 flex flex-col justify-between p-5">
                  <span className="text-dw-muted text-[9px] tracking-[0.25em] uppercase">San Diego</span>
                  <div>
                    <p className="font-display italic text-dw-border text-5xl leading-none mb-1.5 group-hover:text-dw-muted transition-colors">
                      #{issueNumber}
                    </p>
                    <p className="text-dw-muted text-[9px] tracking-widest uppercase">Edición actual</p>
                  </div>
                </div>
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
          className="mt-14 h-px bg-dw-border origin-left" />
      </div>
    </section>
  )
}
