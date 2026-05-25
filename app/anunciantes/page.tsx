import Link from 'next/link'

export default function AnunciantesPage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-dw-black pt-32 pb-24 px-6 md:px-10 border-b border-dw-border">
        <div className="max-w-5xl mx-auto">
          <p className="text-dw-muted text-[10px] tracking-[0.3em] uppercase mb-6">Para anunciantes</p>
          <h1 className="font-display font-bold text-dw-white leading-tight mb-8"
            style={{ fontSize: 'clamp(44px, 7vw, 88px)' }}>
            Llegá a toda
            <em className="block italic text-dw-sub font-normal">la zona norte</em>
          </h1>
          <p className="text-dw-muted text-[15px] leading-relaxed max-w-lg mb-12">
            San Diego La Revista es la publicación de referencia de zona norte de Buenos Aires. Ediciones mensuales, audiencia calificada y presencia digital.
          </p>
          <a href="#contacto-anunciantes"
            className="bg-dw-white text-dw-black text-[11px] font-semibold tracking-[0.12em] uppercase px-9 py-4 hover:bg-dw-text transition-colors duration-200 inline-block">
            Solicitar información →
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-dw-surface border-b border-dw-border">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-dw-border">
          {[
            { val: '+10.000', label: 'Lectores únicos por edición' },
            { val: '+139',    label: 'Ediciones publicadas'        },
            { val: '5 años',  label: 'De trayectoria editorial'    },
          ].map(s => (
            <div key={s.label} className="bg-dw-black px-10 py-16">
              <div className="font-display text-dw-white leading-none mb-4" style={{ fontSize: 'clamp(48px, 5vw, 72px)' }}>
                {s.val}
              </div>
              <p className="text-dw-muted text-[11px] tracking-[0.18em] uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Por qué pautar */}
      <section className="bg-dw-black py-28 px-6 md:px-10 border-b border-dw-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline gap-5 mb-16">
            <span className="text-dw-muted text-[10px] tracking-[0.3em] uppercase">01 /</span>
            <h2 className="font-display text-4xl md:text-5xl text-dw-white font-bold">Por qué pautar</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-dw-border">
            {[
              { n: '01', title: 'Audiencia local y calificada',    desc: 'Llegás a familias, emprendedores y empresas de toda zona norte. Sin ruido.' },
              { n: '02', title: 'Formato revista de alta calidad', desc: 'Tu marca en un contexto premium, no en un feed algorítmico.' },
              { n: '03', title: 'Impacto medible',                 desc: 'Tracking de lecturas, páginas vistas y tiempo de lectura por edición.' },
              { n: '04', title: 'Presencia digital permanente',    desc: 'Cada edición queda online. Tu publicidad sigue activa indefinidamente.' },
            ].map(item => (
              <div key={item.n} className="bg-dw-card p-10 relative overflow-hidden group hover:bg-dw-surface transition-colors duration-200">
                <span className="absolute top-4 right-6 font-display text-[80px] leading-none text-dw-border pointer-events-none select-none" style={{ fontStyle: 'italic' }}>
                  {item.n}
                </span>
                <h3 className="font-display text-dw-white text-xl font-bold mb-3 relative">{item.title}</h3>
                <p className="text-dw-muted text-sm leading-relaxed relative">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formatos */}
      <section className="bg-dw-surface py-28 px-6 md:px-10 border-b border-dw-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline gap-5 mb-16">
            <span className="text-dw-muted text-[10px] tracking-[0.3em] uppercase">02 /</span>
            <h2 className="font-display text-4xl md:text-5xl text-dw-white font-bold">Formatos</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-dw-border">
            {[
              { name: 'Página entera',    size: '21×28 cm', desc: 'Máxima visibilidad. Ideal para marca o producto.' },
              { name: 'Media página',     size: '21×14 cm', desc: 'Alta visibilidad con inversión intermedia.'        },
              { name: 'Cuarto de página', size: '10×14 cm', desc: 'Perfecto para servicios locales.'                  },
              { name: 'Contratapa',       size: '21×28 cm', desc: 'La posición más premium de la revista.'            },
              { name: 'Portada interior', size: '21×28 cm', desc: 'Segunda posición de mayor impacto.'                },
              { name: 'Doble página',     size: '42×28 cm', desc: 'Para campañas de gran escala.'                     },
            ].map(f => (
              <div key={f.name} className="bg-dw-black p-8 group hover:bg-dw-card transition-colors duration-200">
                <p className="text-dw-muted text-[10px] tracking-[0.2em] uppercase mb-3">{f.size}</p>
                <h3 className="font-display text-dw-text font-bold text-lg mb-2">{f.name}</h3>
                <p className="text-dw-muted text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto-anunciantes" className="bg-dw-black py-28 px-6 md:px-10">
        <div className="max-w-lg mx-auto">
          <div className="flex items-baseline gap-5 mb-12">
            <span className="text-dw-muted text-[10px] tracking-[0.3em] uppercase">03 /</span>
            <h2 className="font-display text-4xl text-dw-white font-bold">Contacto</h2>
          </div>
          <form action="https://formspree.io/f/xwpkdqbn" method="POST" className="flex flex-col gap-3">
            <input name="nombre" type="text" placeholder="Nombre o empresa"
              className="bg-dw-card border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-hover transition-colors" />
            <input name="email" type="email" placeholder="Email"
              className="bg-dw-card border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-hover transition-colors" />
            <input name="telefono" type="tel" placeholder="Teléfono (opcional)"
              className="bg-dw-card border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-hover transition-colors" />
            <textarea name="mensaje" placeholder="Contanos sobre tu marca" rows={4}
              className="bg-dw-card border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-hover transition-colors resize-none" />
            <button type="submit"
              className="bg-dw-white text-dw-black text-[11px] font-semibold tracking-[0.12em] uppercase py-4 hover:bg-dw-text transition-colors duration-200 mt-2">
              Enviar consulta →
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
