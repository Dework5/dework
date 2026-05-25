'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import Link from 'next/link'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const itemVariant = {
  hidden: { opacity: 0, y: 24 },
  show:  { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as any } },
}

const ACCENTS = ['#C5A56B', '#6B9B8A', '#9B6B7A', '#6B7B9B', '#9B896B']

const PATTERNS = [
  'repeating-linear-gradient(-45deg, #1a1a1a 0,#1a1a1a 1px,transparent 0,transparent 16px)',
  'repeating-linear-gradient(-60deg, #191919 0,#191919 1px,transparent 0,transparent 12px)',
  'repeating-linear-gradient(-30deg, #1a1a1a 0,#1a1a1a 1px,transparent 0,transparent 18px)',
  'repeating-linear-gradient(-45deg, #181818 0,#181818 1px,transparent 0,transparent 10px)',
  'repeating-linear-gradient(-60deg, #1b1b1b 0,#1b1b1b 1px,transparent 0,transparent 14px)',
]

export function PublicationsSection({ publications }: { publications: any[] }) {
  const [main, ...rest] = publications

  return (
    <section id="publicaciones" className="bg-dw-black py-28 px-6 md:px-10">
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }}
          className="mb-16">
          <div className="flex items-baseline gap-5 mb-4">
            <span className="text-dw-muted text-[10px] tracking-[0.3em] uppercase">01 /</span>
            <h2 className="font-display text-4xl md:text-5xl text-dw-white font-bold">Publicaciones</h2>
          </div>
          <p className="text-dw-sub text-sm max-w-lg leading-relaxed">
            Cinco revistas que cubren el estilo de vida, la comunidad y la cultura de San Diego, Pilar y zona norte.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={stagger} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-2 md:grid-cols-3 gap-px bg-dw-border">

          {/* Main card */}
          {main && (
            <motion.div variants={itemVariant}
              className="col-span-2 md:col-span-1 row-span-2 bg-dw-card relative group overflow-hidden"
              style={{ minHeight: '420px', borderTop: `2px solid ${ACCENTS[0]}` }}>

              {main.latest_issue?.cover_url ? (
                <div className="absolute inset-0">
                  <Image
                    src={main.latest_issue.cover_url}
                    alt={`Portada ${main.name}`}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                </div>
              ) : (
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                  style={{ backgroundImage: PATTERNS[0] }} />
              )}

              <Link href={`/revistas/${main.slug}`} className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] tracking-[0.22em] uppercase ${main.latest_issue?.cover_url ? 'text-white/70' : 'text-dw-muted'}`}>
                    {main.shortName || main.short_name || 'SDLR'}
                  </span>
                  <span className={`text-lg transition-colors duration-200 ${main.latest_issue?.cover_url ? 'text-white/40 group-hover:text-white/80' : 'text-dw-border group-hover:text-dw-sub'}`}>
                    &nearr;
                  </span>
                </div>
                <div>
                  <h3 className={`font-display font-bold text-2xl md:text-3xl leading-tight mb-3 ${main.latest_issue?.cover_url ? 'text-white' : 'text-dw-white'}`}>
                    {main.name}
                  </h3>
                  {main.description && (
                    <p className={`text-xs leading-relaxed mb-4 max-w-[240px] ${main.latest_issue?.cover_url ? 'text-white/75' : 'text-dw-sub'}`}>
                      {main.description}
                    </p>
                  )}
                  <p className={`text-xs tracking-widest ${main.latest_issue?.cover_url ? 'text-white/60' : 'text-dw-muted'}`}>
                    {main.issueCount || main.issue_count || 139} ediciones
                  </p>
                </div>
              </Link>

              <div className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"
                style={{ background: ACCENTS[0] }} />
            </motion.div>
          )}

          {/* Secondary cards */}
          {rest.map((pub: any, i: number) => (
            <motion.div key={pub.slug} variants={itemVariant}
              className="bg-dw-card relative group overflow-hidden"
              style={{ minHeight: '210px', borderTop: `2px solid ${ACCENTS[i + 1] || '#1E1E1E'}` }}>

              {pub.latest_issue?.cover_url ? (
                <div className="absolute inset-0">
                  <Image
                    src={pub.latest_issue.cover_url}
                    alt={`Portada ${pub.name}`}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                </div>
              ) : (
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{ backgroundImage: PATTERNS[i + 1] }} />
              )}

              <Link href={`/revistas/${pub.slug}`} className="absolute inset-0 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] tracking-[0.2em] uppercase ${pub.latest_issue?.cover_url ? 'text-white/60' : 'text-dw-sub'}`}>
                    {pub.shortName || pub.short_name || pub.name?.slice(0, 4)}
                  </span>
                  <span className={`text-sm transition-colors duration-200 ${pub.latest_issue?.cover_url ? 'text-white/40 group-hover:text-white/80' : 'text-dw-muted group-hover:text-dw-sub'}`}>
                    &nearr;
                  </span>
                </div>
                <div>
                  <h3 className={`font-display font-semibold text-xl leading-tight mb-1.5 ${pub.latest_issue?.cover_url ? 'text-white' : 'text-dw-white'}`}>
                    {pub.name}
                  </h3>
                  <p className={`text-xs tracking-widest ${pub.latest_issue?.cover_url ? 'text-white/55' : 'text-dw-sub'}`}>
                    {pub.issueCount || pub.issue_count || '--'} ediciones
                  </p>
                </div>
              </Link>

              <div className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"
                style={{ background: ACCENTS[i + 1] || '#888' }} />
            </motion.div>
          ))}

        </motion.div>
      </div>
    </section>
  )
}