'use client'

import Image from 'next/image'

// Portada de la web: presentación de Dework (qué hacemos) y, a la derecha, las tapas de todas las revistas
export function HeroSection({ publications }: { publications: any[] }) {
  const tapas = publications.filter((p: any) => p.latest_issue?.cover_url).slice(0, 6).reverse() // San Diego queda adelante

  return (
    <section
      className="relative flex flex-col justify-center bg-dw-black overflow-hidden"
      style={{ minHeight: '100svh' }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 90% 70% at 65% 35%, #F3F7F0 0%, #E6EEE1 60%, #DCE6D6 100%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-16 pt-32 pb-12 md:pt-36 md:pb-20">
        <div className="grid md:grid-cols-[1fr_420px] gap-12 md:gap-16 items-center">

          <div>
            <div className="flex items-center gap-3 mb-6 md:mb-9">
              <span className="w-8 h-px bg-dw-gold" />
              <span className="text-dw-gold text-[10px] tracking-[0.28em] uppercase">Dework · Agencia Digital · Pilar, Buenos Aires</span>
            </div>

            <h1 className="font-display font-normal text-dw-white leading-[0.98] tracking-tight mb-6"
              style={{ fontSize: 'clamp(46px, 6.4vw, 84px)' }}>
              Contamos la vida<br />de cada comunidad
              <em className="block font-display italic font-normal text-dw-gold mt-3" style={{ fontSize: '0.5em' }}>
                revistas de clubes y countries
              </em>
            </h1>

            <p className="text-dw-sub text-[15px] md:text-base leading-[1.75] max-w-[500px] mb-7">
              Somos la editorial de los clubes y countries de la zona. Desde 2014 hacemos sus revistas de punta a punta:
              contenidos, fotografía y diseño editorial, una versión web que se lee rápido en el celular,
              el envío a los socios por WhatsApp y la difusión en redes. Y conectamos a cada comunidad con los anunciantes que la eligen.
            </p>

            <ul className="grid sm:grid-cols-3 gap-px bg-dw-gold/40 border border-dw-gold/40 max-w-[560px] mb-8 md:mb-10">
              {[['Diseño editorial', 'Una revista de primera, mes a mes'], ['Web y WhatsApp', 'Cada edición, al instante en el celular'], ['Anunciantes', 'Avisos con link directo a cada marca']].map(([t, d]) => (
                <li key={t} className="bg-dw-black/60 px-4 py-4">
                  <p className="font-display text-dw-white text-lg leading-tight">{t}</p>
                  <p className="text-dw-sub text-[12px] leading-snug mt-1">{d}</p>
                </li>
              ))}
            </ul>

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

          {/* Tapas de las revistas, en abanico */}
          {tapas.length > 0 && (
            <a href="#publicaciones" aria-label="Ver las revistas" className="relative block [--abanico:24px] md:[--abanico:34px] h-[250px] md:h-[460px] group">
              {tapas.map((p: any, i: number) => {
                const n = tapas.length, k = i - (n - 1) / 2
                return (
                  <div key={p.slug}
                    className="absolute top-1/2 left-1/2 w-[140px] md:w-[230px] aspect-[210/297] bg-dw-surface overflow-hidden shadow-[0_10px_34px_rgba(31,42,36,0.22)] outline outline-1 outline-dw-gold/70 transition-transform duration-500"
                    style={{ transform: `translate(-50%, -50%) translateX(calc(${k} * var(--abanico, 34px))) rotate(${k * 5}deg)`, zIndex: i === n - 1 ? 10 : i }}>
                    <Image src={p.latest_issue.cover_url} alt={`Portada ${p.name}`} fill unoptimized className="object-cover" sizes="230px" />
                  </div>
                )
              })}
            </a>
          )}
        </div>

        <div className="mt-10 md:mt-14 h-px bg-dw-gold/50" />
      </div>
    </section>
  )
}
