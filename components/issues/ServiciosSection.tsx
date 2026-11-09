import servicios from '@/data/sd-servicios.json'

type Servicio = { marca: string; nombre?: string; rubro?: string; tel?: string; whatsapp: string; imagen: string; seccion?: string }

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
      aria-label={esWa ? `Escribir por WhatsApp a ${s.nombre ?? s.marca}` : `Ver más de ${s.nombre ?? s.marca}`}
      className="group flex flex-col"
    >
      {/* todas las tarjetas a la misma altura, para que los renglones queden parejos */}
      <div className="aspect-[600/1044] bg-white shadow-[0_8px_26px_rgba(31,42,36,0.14)] group-hover:shadow-[0_12px_34px_rgba(31,42,36,0.26)] transition-shadow duration-300 overflow-hidden">
        <img src={s.imagen} alt={s.nombre ?? s.marca} width={600} height={1044} loading="lazy" className="w-full h-full object-contain block transition-transform duration-500 group-hover:scale-[1.02]" />
      </div>
      <p className="font-display text-dw-white text-[15px] md:text-base leading-tight mt-3">{s.nombre ?? s.marca}</p>
      {s.rubro && <p className="text-dw-sub text-[11px] md:text-xs leading-snug mt-1">{s.rubro}</p>}
      {esWa && s.tel && <p className="md:hidden text-dw-text text-[13px] mt-1 tabular-nums">{s.tel}</p>}
      <p className="text-dw-gold text-[10px] tracking-[0.18em] uppercase mt-2 group-hover:underline underline-offset-4">
        {esWa ? <>WhatsApp<span className="hidden md:inline">{s.tel ? ' · ' + s.tel : ''}</span> →</> : 'Ver más →'}
      </p>
    </a>
  )
}

// Clases fijas (Tailwind necesita verlas escritas)
const SPAN = ['', 'col-span-1', 'col-span-2', 'col-span-3', 'col-span-4', 'col-span-5']
const COLS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5']
type Tramo = { titulo: string; items: Servicio[] }
// Reparte las tarjetas (en orden de rubro) en renglones completos de `c` columnas; cada pedazo de renglón lleva el título de su rubro
function renglones(grupos: { titulo: string; items: Servicio[] }[], c: number): Tramo[][] {
  const filas: Tramo[][] = []
  let fila: Tramo[] = [], usados = 0
  for (const g of grupos) for (const it of g.items) {
    const ult = fila[fila.length - 1]
    if (ult && ult.titulo === g.titulo) ult.items.push(it)
    else fila.push({ titulo: g.titulo, items: [it] })
    if (++usados === c) { filas.push(fila); fila = []; usados = 0 }
  }
  if (fila.length) filas.push(fila)
  return filas
}
function Renglones({ grupos, c, className }: { grupos: { titulo: string; items: Servicio[] }[]; c: number; className: string }) {
  return (
    <div className={`${className} space-y-10 md:space-y-12`}>
      {renglones(grupos, c).map((fila, k, todas) => (
        <div key={k} className={`grid ${COLS[c]} gap-x-4 md:gap-x-6`}>
          {fila.map((t, n) => (
            <div key={n} className={SPAN[t.items.length]}>
              {/* el título va cuando empieza el rubro; si el rubro sigue en el renglón de abajo, solo la línea */}
              <h3 style={n === 0 && k > 0 && todas[k - 1].at(-1)!.titulo === t.titulo ? { color: 'transparent' } : undefined} className="text-dw-gold text-[10px] md:text-[11px] tracking-[0.28em] uppercase border-b border-dw-gold/40 pb-2 mb-4 md:mb-5 truncate" title={t.titulo}>
                {t.titulo}
              </h3>
              <div className={`grid ${COLS[t.items.length]} gap-4 md:gap-6`}>
                {t.items.map(s => <Tarjeta key={s.marca} s={s} />)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
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
  // la tarjeta verde "Sumá tu servicio" ya está como texto arriba y abajo: no ocupa un renglón propio
  const conTitulo = grupos.filter(g => g.titulo)
  // los rubros chicos van antes que los grandes que siguen, así los renglones quedan completos y cada rubro junto
  const ORDEN = ['Para la casa', 'Mascotas', 'Bienestar y belleza', 'Deporte y tiempo libre', 'Gastronomía y compras', 'Salud, autos e inmobiliarias']
  const orden = [...conTitulo].sort((a, b) => (ORDEN.indexOf(a.titulo) + 99) % 99 - (ORDEN.indexOf(b.titulo) + 99) % 99)
  return (
    <section id="servicios" className="scroll-mt-28 md:scroll-mt-32 bg-dw-black py-14 md:py-24 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 md:mb-14 text-center">
          {/* sello «Los Recomendados · Guía de servicios · San Diego La Revista» */}
          <img src="/sello-los-recomendados.png" alt="Los Recomendados · Guía de servicios San Diego La Revista" width={400} height={400} className="w-28 h-28 md:w-36 md:h-36 mx-auto mb-5 drop-shadow-[0_6px_16px_rgba(22,54,43,0.25)]" />
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

        {/* Renglones completos (5 por renglón en la compu, 2 en el celular), cada pedazo con el título de su rubro */}
        <Renglones grupos={orden} c={5} className="hidden md:block" />
        <Renglones grupos={orden} c={2} className="md:hidden" />

        <p className="mt-10 md:mt-14 border-t border-dw-gold/50 pt-5 text-center font-display italic text-dw-text text-base md:text-lg">
          ¿Querés sumar tu servicio o emprendimiento en esta sección de recomendados? Contactate al{' '}
          <a href="https://wa.me/5491133616566" target="_blank" rel="noopener noreferrer" className="not-italic text-dw-gold underline-offset-4 hover:underline">11 3361-6566</a>
        </p>
      </div>
    </section>
  )
}
