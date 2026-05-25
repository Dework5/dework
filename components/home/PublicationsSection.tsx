'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const itemVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as any } },
}

export function PublicationsSection({ publications }: { publications: any[] }) {
  const [main, ...rest] = publications
  return (
    <section id="publicaciones" className="bg-dw-black py-28 px-6 md:px-10">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6 }}
          className="flex items-baseline gap-5 mb-16">
          <span className="text-dw-muted text-[10px] tracking-[0.3em] uppercase">01 /</span>
          <h2 className="font-display text-4xl md:text-5xl text-dw-white font-bold">Publicaciones</h2>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-2 md:grid-cols-3 gap-px bg-dw-border">
          {main && (
            <motion.div variants={itemVariant}
              className="col-span-1 row-span-2 bg-dw-card relative group overflow-hidden"
              style={{ minHeight: '420px' }}>
              <Link href={`/revistas/${main.slug}`} className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-dw-muted text-[10px] tracking-[0.22em] uppercase">{main.shortName || 'SDLR'}</span>
                  <span className="text-dw-hover group-hover:text-dw-sub transition-colors">↗</span>
                </div>
                <div>
                  <h3 className="font-display text-dw-white font-bold text-2xl md:text-3xl leading-tight mb-2">{main.name}</h3>
                  <p className="text-dw-muted text-xs">{main.issueCount || main.issue_count || 139} ediciones</p>
                </div>
              </Link>
              <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #fff 0,#fff 1px,transparent 0,transparent 14px)' }} />
              <div className="absolute top-0 left-0 right-0 h-px bg-dw-white origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </motion.div>
          )}
          {rest.map((pub: any) => (
            <motion.div key={pub.slug} variants={itemVariant}
              className="bg-dw-card relative group overflow-hidden" style={{ minHeight: '200px' }}>
              <Link href={`/revistas/${pub.slug}`} className="absolute inset-0 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-dw-muted text-[10px] tracking-[0.2em] uppercase">{pub.shortName || pub.name?.slice(0,4)}</span>
                  <span className="text-dw-hover group-hover:text-dw-sub transition-colors text-sm">↗</span>
                </div>
                <div>
                  <h3 className="font-display text-dw-text font-bold text-xl leading-tight mb-1">{pub.name}</h3>
                  <p className="text-dw-muted text-xs">{pub.issueCount || pub.issue_count || '—'} ediciones</p>
                </div>
              </Link>
              <div className="absolute top-0 left-0 right-0 h-px bg-dw-white origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
