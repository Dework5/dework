import servicios from '@/data/sd-servicios.json'

type Servicio = { marca: string; whatsapp: string; imagen: string; seccion?: string }

// Servicios recomendados de San Diego (los mismos de la guía de la revista), agrupados por rubro con su título,
// en el mismo orden que la revista. Cada tarjeta abre el WhatsApp del servicio (o la web / Instagram del anunciante).
// Se regenera con `node scripts/servicios-web.mjs <carpeta>`.
function Tarjeta({ s }: { s: Servicio }) {
  const esWa = s.whatsapp.includes('wa.me/')
  return (
    <a
      // pasa por /ir/<anunciante> para contar el contacto y de ahí abre su WhatsApp, web o Instagram
      href={`/ir/${s.imagen.replace(/^\/servicios\//, '').replace(/\.webp$/, '')}`}
      target="_blank"
      rel="noopener"
      aria-label={esWa ? `Escribir por WhatsApp a ${s.marca}` : `Ver más de ${s.marca}`}
      className="group block"
    >
      <div className="shadow-[0_8px_26px_rgba(31,42,36,0.14)] group-hover:shadow-[0_12px_34px_rgba(31,42,36,0.26)] transition-shadow duration-300 overflow-hidden">
        <img src={s.imagen} alt={s.marca} width={600} height={1044} loading="lazy" className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]" />
      </div>
      <p className="text-dw-gold text-[9px] tracking-[0.25em] uppercase mt-3">{esWa ? 'WhatsApp →' : 'Ver más →'}</p>
    </a>
  )
}

export function ServiciosSection() {
  const lista = servicios as Servicio[]
  if (!lista.length) return null
  // agrupar por sección respetando el orden de aparición; las que no tienen sección ("Sumá tu servicio") van al final
  const grupos: { titulo: string; items: Servicio[] }[] = []
  for (const s of lista) {
    const t = s.seccion ?? ''
    const g = grupos.find(x => x.titulo === t)
    if (g) g.items.push(s)
    else grupos.push({ titulo: t, items: [s] })
  }
  grupos.sort((a, b) => Number(!a.titulo) - Number(!b.titulo))
  return (
    <section id="servicios" className="scroll-mt-28 md:scroll-mt-32 bg-dw-black py-14 md:py-24 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 md:mb-14 text-center">
          <h2 className="font-display text-4xl md:text-6xl text-dw-white font-normal mb-4">
            Servicios <i className="text-dw-gold">recomendados</i>
          </h2>
          <p className="font-display text-2xl md:text-3xl text-dw-white">
            Contactá a tu <i className="text-dw-gold">servicio recomendado</i>
          </p>
          <div className="w-16 border-t border-dw-gold/60 mx-auto my-5" />
          <p className="text-dw-text text-base md:text-lg">
            Si querés sumarte, contactanos al{' '}
            <a href="https://wa.me/5491133616566" target="_blank" rel="noopener noreferrer" className="text-dw-gold font-medium underline-offset-4 hover:underline whitespace-nowrap">11 3361-6566</a>
          </p>
        </div>

        <div className="space-y-10 md:space-y-14">
          {grupos.map(g => (
            <div key={g.titulo || 'otros'}>
              {g.titulo && (
                <h3 className="text-dw-gold text-[11px] md:text-xs tracking-[0.3em] uppercase border-b border-dw-gold/40 pb-2 mb-5 md:mb-6">
                  {g.titulo}
                </h3>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
                {g.items.map(s => <Tarjeta key={s.marca} s={s} />)}
              </div>
            </div>
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
