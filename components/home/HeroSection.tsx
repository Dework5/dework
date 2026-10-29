'use client'

import Image from 'next/image'

// Portada de la web: presentación de Dework y, a la derecha, la tapa de la última San Diego La Revista.
// La tapa está guardada en la web (public/tapas) para que se vea siempre, aunque la base de datos no responda.
export function HeroSection({ publications }: { publications: any[] }) {
  const sd = publications.find((p: any) => p.slug === 'san-diego-la-revista')
  const numero = sd?.latest_issue?.issue_number ?? 144

  return (
    <section
      className="relative flex flex-col justify-center bg-dw-black overflow-hidden"
      
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 90% 70% at 65% 35%, #F3F7F0 0%, #E6EEE1 60%, #DCE6D6 100%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-16 pt-32 pb-10 md:pt-40 md:pb-14">
        <div className="grid md:grid-cols-[1fr_420px] gap-12 md:gap-16 items-center">

          <div>
            <div className="flex items-center gap-3 mb-6 md:mb-9">
              <span className="w-8 h-px bg-dw-gold" />
              <span className="text-dw-gold text-[10px] tracking-[0.28em] uppercase">Dework · Agencia Digital · Pilar, Buenos Aires</span>
            </div>

            <h1 className="font-display font-normal text-dw-white leading-[1] tracking-tight mb-6"
              style={{ fontSize: 'clamp(44px, 6vw, 80px)' }}>
              Revistas de <em className="italic text-dw-gold">clubes y countries</em>
            </h1>

            <p className="text-dw-sub text-[15px] md:text-base leading-[1.7] max-w-[440px] mb-8 md:mb-10">
              Desde 2014: diseño editorial.
            </p>

            <div className="flex flex-wrap items-center gap-5">
              <a href="#publicaciones"
                className="bg-dw-green text-dw-black text-[11px] tracking-[0.2em] uppercase px-8 py-4 hover:bg-dw-white transition-colors duration-200">
                VER LAS REVISTAS →
              </a>
              <a href="#contacto"
                className="text-dw-sub text-[11px] tracking-[0.18em] uppercase hover:text-dw-white transition-colors border-b border-dw-gold pb-px">
                Pedir la revista de tu club →
              </a>
            </div>
          </div>

          {/* Tapa de la última San Diego La Revista */}
          <a href={`/revistas/san-diego-la-revista/${numero}`} aria-label="Leer San Diego La Revista" className="block justify-self-center md:justify-self-end w-[220px] md:w-[300px] group">
            <div className="relative aspect-[210/297] overflow-hidden shadow-[0_14px_40px_rgba(31,42,36,0.25)] outline outline-1 outline-dw-gold outline-offset-[6px]">
              <Image src={sd?.latest_issue?.cover_url ?? "/tapas/san-diego-144.jpg"} alt={`San Diego La Revista n° ${numero}`} fill unoptimized className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" sizes="300px" priority />
            </div>
            <p className="text-dw-gold text-[10px] tracking-[0.25em] uppercase mt-5">Última edición</p>
            <p className="font-display text-dw-white text-xl leading-tight mt-1">San Diego La Revista <i className="text-dw-gold">n° {numero}</i></p>
          </a>
        </div>

        <div className="mt-10 md:mt-14 h-px bg-dw-gold/50" />
      </div>
    </section>
  )
}
