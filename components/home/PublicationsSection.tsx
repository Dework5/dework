'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const itemVariant = {
  hidden: { opacity: 0, y: 24 },
  show:  { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as any } },
}

// Accent color per publication (top border + hover line)
const ACCENTS = ['#C5A56B', '#6B9B8A', '#9B6B7A', '#6B7B9B', '#9B896B']

// Subtle diagonal-stripe pattern per card
const PATTERNS = [
  'repeating-linear-gradient(-45deg, #161616 0,#161616 1px,transparent 0,transparent 16px)',
  'repeating-linear-gradient(-60deg, #131313 0,#131313 1px,transparent 0,transparent 12px)',
  'repeating-linear-gradient(-30deg, #141414 0,#141414 1px,transparent 0,transparent 18px)',
  'repeating-linear-gradient(-45deg, #121212 0,#121212 1px,transparent 0,transparent 10px)',
  'repeating-linear-gradient(-60deg, #151515 0,#151515 1px,transparent 0,transparent 14px)',
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
          <p className="text-dw-muted text-sm max-w-lg leading-relaxed">
            Cinco revistas que cubren el estilo de vida, la comunidad y la cultura de San Diego, Pilar y zona norte.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={stagger} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-2 md:grid-cols-3 gap-px bg-dw-border">

          {/* Main — spans 2 rows on desktop */}
          {main && (
            <motion.div variants={itemVariant}
              className="col-span-2 md:col-span-1 row-span-2 bg-dw-card relative group overflow-hidden"
              style={{ minHeight: '420px', borderTop: `2px solid ${ACCENTS[0]}` }}>
              <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{ backgroundImage: PATTERNS[0] }} />
              <Link href={`/revistas/${main.slug}`} className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-dw-muted text-[10px] tracking-[0.22em] uppercase">
                    {main.shortName || main.short_name || 'SDLR'}
                  </span>
                  <span className="text-dw-border group-hover:text-dw-sub text-lg transition-colors duration-200">↗</span>
                </div>
                <div>
                  <h3 className="font-display text-dw-white font-bold text-2xl md:text-3xl leading-tight mb-3">
                    {main.name}
                  </h3>
                  {main.description && (
                    <p className="text-dw-muted text-xs leading-relaxed mb-4 max-w-[240px]">{main.description}</p>
                  )}
                  <p className="text-dw-muted text-xs tracking-widest">
                    {main.issueCount || main.issue_count || 139} ediciones
                  </p>
                </div>
              </Link>
              {/* Hover top-line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"
                style={{ background: ACCENTS[0] }} />
            </motion.div>
          )}

          {/* Secondary cards */}
          {rest.map((pub: any, i: number) => (
            <motion.div key={pub.slug} variants={itemVariant}
              className="bg-dw-card relative group overflow-hidden"
              style={{ minHeight: '210px', borderTop: `2px solid ${ACCENTS[i + 1] || '#1E1E1E'}` }}>
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                style={{ backgroundImage: PATTERNS[i + 1] }} />
              <Link href={`/revistas/${pub.slug}`} className="absolute inset-0 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-dw-sub text-[10px] tracking-[0.2em] uppercase">
                    {pub.shortName || pub.short_name || pub.name?.slice(0, 4)}
                  </span>
                  <span className="text-dw-muted group-hover:text-dw-sub text-sm transition-colors duration-200">↗</span>
                </div>
                <div>
                  <h3 className="font-display text-dw-white font-semibold text-xl leading-tight mb-1.5">
                    {pub.name}
                  </h3>
                  <p className="text-dw-sub text-xs tracking-widest">
                    {pub.issueCount || pub.issue_count || '—'} ediciones
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
