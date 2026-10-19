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
        style={{ background: 'radial-gradient(ellipse 90% 70% at 65% 35%, #F3F7F0 0%, #E6EEE1 60%, #DCE6D6 100%)' }} />

      {/* Giant issue-number watermark */}
      <div aria-hidden className="absolute right-[-4vw] top-1/2 -translate-y-1/2 select-none pointer-events-none leading-none hidden lg:block">
        <span className="font-display font-bold italic"
          style={{ fontSize: 'clamp(260px, 34vw, 480px)', color: 'transparent', WebkitTextStroke: '1px #DCCDAE' }}>
          {issueNumber}
        </span>
      </div>

      {/* Desktop spacer — pushes content to bottom on large screens */}
      <div className="hidden md:block md:flex-1 md:min-h-[11rem]" aria-hidden />

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-16 pt-32 pb-12 md:pt-0 md:pb-20">

        <div className="grid md:grid-cols-[1fr_220px] gap-12 items-end">

          {/* LEFT */}
          <div>
            {/* Badge */}
            <motion.div
              initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-6 md:mb-10">
              <span className="w-8 h-px bg-dw-gold" />
              <span className="text-dw-gold text-[10px] tracking-[0.28em] uppercase">
                Dework · Agencia Digital · Pilar, Buenos Aires
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={false} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
              className="font-display font-normal text-dw-white leading-[0.95] tracking-tight mb-6"
              style={{ fontSize: 'clamp(52px, 7.5vw, 96px)' }}>
              Revistas<br />
              <em className="font-display italic font-normal text-dw-gold"
                style={{ fontSize: '0.62em' }}>de clubes y countries</em>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.28, duration: 0.7 }}
              className="text-dw-sub text-[15px] md:text-base leading-[1.75] max-w-[460px] mb-7 md:mb-8">
              Diseñamos, editamos y publicamos las revistas de San Diego Country Club, Haras del Pilar,
              Pilará, Los Lagartos y Campo Chico.
            </motion.p>

            {/* Cifras */}
            <div className="flex items-stretch mb-8 md:mb-10 border-y border-dw-gold/40 max-w-[460px]">
              {[['11', 'años'], ['201', 'ediciones'], ['5', 'publicaciones']].map(([n, t], i) => (
                <div key={t} className={`flex-1 py-4 ${i ? 'border-l border-dw-gold/40 pl-5' : ''}`}>
                  <div className="font-display text-dw-white text-3xl md:text-4xl leading-none">{n}</div>
                  <div className="text-dw-gold text-[10px] tracking-[0.25em] uppercase mt-2">{t}</div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <motion.div
              initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }}
              className="flex flex-wrap items-center gap-5">
              <a href="#publicaciones"
                className="bg-dw-green text-dw-black text-[11px] tracking-[0.2em] uppercase px-8 py-4 hover:bg-dw-white transition-colors duration-200">
                VER PUBLICACIONES →
              </a>
              <Link href={`/revistas/${slug}/${issueNumber}`}
                className="text-dw-sub text-[11px] tracking-[0.18em] uppercase hover:text-dw-white transition-colors border-b border-dw-gold pb-px">
                Leer la última edición →
              </Link>
            </motion.div>
          </div>

          {/* RIGHT — current issue mini-card */}
          <motion.div
            initial={false} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.22, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="hidden md:block self-end">
            <Link href={`/revistas/${slug}/${issueNumber}`} className="block group">
              <div className="aspect-[3/4] bg-dw-surface relative overflow-hidden mb-4 shadow-[0_10px_40px_rgba(31,42,36,0.18)] outline outline-1 outline-dw-gold outline-offset-[6px] transition-shadow duration-300 group-hover:shadow-[0_14px_50px_rgba(31,42,36,0.25)]">
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
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F2A20]/70 to-transparent" />
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
                      style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #CFDCC8 0,#CFDCC8 1px,transparent 0,transparent 14px)' }} />
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
          initial={false} animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 md:mt-14 h-px bg-dw-gold/50 origin-left" />
      </div>
    </section>
  )
}
