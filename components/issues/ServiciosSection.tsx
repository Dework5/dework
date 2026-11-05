import servicios from '@/data/sd-servicios.json'

// Servicios recomendados de San Diego (los mismos de la guía de la revista): cada tarjeta abre el WhatsApp del servicio.
// Se regenera con `node scripts/servicios-web.mjs <carpeta>`.
export function ServiciosSection() {
  if (!servicios.length) return null
  return (
    <section id="servicios" className="scroll-mt-28 md:scroll-mt-32 bg-dw-black py-14 md:py-24 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 md:mb-12">
          <h2 className="font-display text-4xl md:text-5xl text-dw-white font-normal mb-3">
            Servicios <i className="text-dw-gold">recomendados</i>
          </h2>
          <p className="text-dw-sub text-sm max-w-lg leading-relaxed">
            Los servicios y emprendimientos que recomienda San Diego La Revista. Tocá cada uno para escribirle por WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
          {servicios.map(s => (
            <a
              key={s.marca}
              href={s.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escribir por WhatsApp a ${s.marca}`}
              className="group block"
            >
              <div className="shadow-[0_8px_26px_rgba(31,42,36,0.14)] group-hover:shadow-[0_12px_34px_rgba(31,42,36,0.26)] transition-shadow duration-300 overflow-hidden">
                <img src={s.imagen} alt={s.marca} width={600} height={771} loading="lazy" className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]" />
              </div>
              <p className="text-dw-gold text-[9px] tracking-[0.25em] uppercase mt-3">WhatsApp →</p>
            </a>
          ))}
        </div>

        <p className="mt-10 md:mt-14 border-t border-dw-gold/50 pt-5 text-center font-display italic text-dw-text text-base md:text-lg">
          ¿Querés sumar tu servicio o emprendimiento en esta sección de recomendados? Contactate al{' '}
          <a href="https://wa.me/5491133616566" target="_blank" rel="noopener noreferrer" className="not-italic text-dw-gold underline-offset-4 hover:underline">11 3361-6566</a>
        </p>
      </div>
    </section>
  )
}
