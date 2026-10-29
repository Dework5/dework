'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import Link from 'next/link'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const itemVariant = {
  hidden: { opacity: 0, y: 24 },
  show:  { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as any } },
}

// Acento dorado para todas (estilo Club)
const ACCENTS = ['#A88650', '#A88650', '#A88650', '#A88650', '#A88650']

const PATTERNS = [
  'repeating-linear-gradient(-45deg, #CFDCC8 0,#CFDCC8 1px,transparent 0,transparent 16px)',
  'repeating-linear-gradient(-60deg, #CFDCC8 0,#CFDCC8 1px,transparent 0,transparent 12px)',
  'repeating-linear-gradient(-30deg, #CFDCC8 0,#CFDCC8 1px,transparent 0,transparent 18px)',
  'repeating-linear-gradient(-45deg, #CFDCC8 0,#CFDCC8 1px,transparent 0,transparent 10px)',
  'repeating-linear-gradient(-60deg, #CFDCC8 0,#CFDCC8 1px,transparent 0,transparent 14px)',
]

// Cantidad de ediciones = número de la última edición publicada (las revistas se numeran desde la 1)
const ediciones = (p: any) => { const n = p.latest_issue?.issue_number ?? p.issueCount ?? p.issue_count; return n ? `Edición n° ${n}` : 'Próximamente' }

export function PublicationsSection({ publications }: { publications: any[] }) {
  const [main, ...rest] = publications

  return (
    <section id="publicaciones" className="bg-dw-black py-14 md:py-28 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0 }} transition={{ duration: 0.6 }}
          className="mb-8 md:mb-16">
          <div className="flex items-baseline gap-4 mb-3">
            <span className="text-dw-gold text-[10px] tracking-[0.3em] uppercase">01 /</span>
            <h2 className="font-display text-4xl md:text-5xl text-dw-white font-normal">Publicaciones</h2>
          </div>
          <p className="text-dw-sub text-sm max-w-lg leading-relaxed">
            Seis revistas que cubren el estilo de vida, la comunidad y la cultura de cada club y country.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={stagger} initial="hidden" whileInView="show"
          viewport={{ once: true, amount: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-dw-border">

          {/* Main card */}
          {main && (
            <motion.div variants={itemVariant}
              className={`col-span-2 md:col-span-1 ${rest.length > 4 ? 'md:row-span-3' : 'row-span-2'} bg-dw-card relative group overflow-hidden`}
              style={{ minHeight: '420px', borderTop: `2px solid ${ACCENTS[0]}` }}>

              {main ? (
                <div className="absolute inset-0 bg-[#16362B] px-8 pt-8 pb-40">
                  <div className="relative w-full h-full">
                    <Image
                      src={main.latest_issue?.cover_url}
                      alt={`Portada ${main.name}`}
                      fill
                      unoptimized
                      className="object-contain object-top drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition-transform duration-700 group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                  style={{ backgroundImage: PATTERNS[0] }} />
              )}

              <Link href={`/revistas/${main.slug}`} className="absolute inset-0 p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span />
                </div>
                <div>
                  <h3 className={`font-display font-normal text-2xl md:text-3xl leading-tight mb-3 text-white`}>
                    {main.name}
                  </h3>
                  {main.description && (
                    <p className={`text-xs leading-relaxed mb-4 max-w-[240px] text-white/75`}>
                      {main.description}
                    </p>
                  )}
                  <p className={`text-xs tracking-widest text-white/60`}>
                    {ediciones(main)}
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
              style={{ minHeight: '250px', borderTop: `2px solid ${ACCENTS[i + 1] || '#1E1E1E'}` }}>

              {/* Otras revistas: solo la tapa (sin ediciones para leer) */}
              <div className="absolute inset-0 bg-[#16362B]">
                {pub.latest_issue?.cover_url && (
                  <div className="absolute top-4 bottom-4 right-4 w-[46%]">
                    <Image src={pub.latest_issue.cover_url} alt={`Tapa ${pub.name}`} fill unoptimized
                      className="object-contain object-right drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]" sizes="200px" />
                  </div>
                )}
              </div>
              <div className="absolute inset-0 p-6 pr-[52%] flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] tracking-[0.2em] uppercase text-white/60`}>
                    {pub.shortName || pub.short_name || pub.name?.slice(0, 4)}
                  </span>
                </div>
                <div>
                  <h3 className={`font-display font-normal text-2xl md:text-[28px] leading-tight mb-2 text-white`}>
                    {pub.name}
                  </h3>
                  <p className={`text-xs tracking-widest text-white/55`}>
                    {ediciones(pub)}
                  </p>
                </div>
              </div>

              <div className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"
                style={{ background: ACCENTS[i + 1] || '#888' }} />
            </motion.div>
          ))}

          {/* Si queda un lugar libre en la grilla: invitación para nuevas revistas */}
          {rest.length % 2 === 1 && (
            <motion.div variants={itemVariant} className="bg-[#16362B] relative group overflow-hidden" style={{ minHeight: '250px', borderTop: '2px solid #A88650' }}>
              <a href="#contacto" className="absolute inset-0 p-6 flex flex-col justify-between text-[#F4EFE4]">
                <span className="text-[10px] tracking-[0.2em] uppercase text-[#D9C29A]">Tu revista</span>
                <div>
                  <h3 className="font-display font-normal text-xl leading-tight mb-1.5">¿Tu club o country? <i className="text-[#D9C29A]">Creamos su revista</i></h3>
                  <p className="text-xs tracking-widest text-[#EAE2CF]/80">Pedir propuesta →</p>
                </div>
              </a>
            </motion.div>
          )}

        </motion.div>

        {/* Para nuevos clientes: pedir la revista de su club o country */}
        <div className="mt-8 md:mt-10 bg-[#16362B] text-[#F4EFE4] px-7 py-9 md:px-12 md:py-11 grid md:grid-cols-[1fr_auto] gap-7 md:gap-12 items-center outline outline-1 outline-[#B08D57]/60 outline-offset-[6px]">
          <div>
            <p className="text-[#D9C29A] text-[10px] tracking-[0.3em] uppercase mb-3">Tu revista</p>
            <h3 className="font-display font-normal text-3xl md:text-4xl leading-tight">
              ¿Tu club o country quiere <i className="text-[#D9C29A]">su propia revista?</i>
            </h3>
            <p className="text-[#EAE2CF]/85 text-[15px] leading-relaxed mt-4 max-w-2xl">
              Diseño editorial, edición mensual, versión web para leer en el celular y envío por WhatsApp. Te armamos una propuesta a medida.
            </p>
          </div>
          <a href="#contacto" className="justify-self-start md:justify-self-end bg-[#B08D57] text-[#F4EFE4] text-[11px] tracking-[0.22em] uppercase px-8 py-4 hover:bg-[#9a7a49] transition-colors whitespace-nowrap">
            Pedir propuesta →
          </a>
        </div>
      </div>
    </section>
  )
}