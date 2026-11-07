'use client'

import { useRef, useState } from 'react'

// Franja "Main sponsor" (Audi Buenos Aires) con el video del reel de la revista (vertical, 20 s).
// Arranca solo, sin sonido y en loop (así lo permiten los navegadores); el botón activa el audio.
// Original en ediciones/145/entrada/sponsor/.
const VIDEO = '/sponsor/audi.mp4'
const POSTER = '/sponsor/audi-poster.jpg'
const URL_AUDI = 'https://www.audi.com.ar/ar/web/es.html'

export function MainSponsor() {
  const ref = useRef<HTMLVideoElement>(null)
  const [sonido, setSonido] = useState(false)
  const alternarSonido = () => {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
    setSonido(!v.muted)
    if (!v.muted) v.play()
  }

  return (
    <section id="sponsor" aria-label="Main sponsor" className="scroll-mt-28 md:scroll-mt-32 bg-[#0d0d0d] text-white py-10 md:py-16 px-5 md:px-12">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[1.4fr_1fr] gap-8 md:gap-14 items-center">
        <div>
          <p className="text-dw-gold text-[10px] tracking-[0.35em] uppercase mb-4">Main sponsor</p>
          <h2 className="font-display font-normal text-4xl md:text-5xl leading-tight mb-4">
            Audi <i className="text-dw-gold">Buenos Aires</i>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-7 max-w-xs">
            Acompaña a San Diego La Revista.
          </p>
          <a
            href={URL_AUDI}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[10px] tracking-[0.28em] uppercase border border-white/40 px-5 py-3 hover:border-dw-gold hover:text-dw-gold transition-colors"
          >
            Conocé Audi →
          </a>
        </div>

        <div className="relative w-full max-w-[340px] mx-auto md:mx-0 md:justify-self-end aspect-[9/16] bg-black overflow-hidden rounded-md shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <video
            ref={ref}
            src={VIDEO}
            poster={POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Video de Audi Buenos Aires"
            className="w-full h-full object-cover"
          />
          <button
            onClick={alternarSonido}
            className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] tracking-[0.2em] uppercase px-3 py-2 rounded-sm hover:bg-black/80"
          >
            {sonido ? 'Silenciar' : 'Activar sonido'}
          </button>
        </div>
      </div>
    </section>
  )
}
