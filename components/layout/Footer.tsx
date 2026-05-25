import Link from 'next/link'
import Image from 'next/image'

const PUBS = [
  { slug: 'san-diego-la-revista', name: 'San Diego La Revista' },
  { slug: 'haras-del-pilar',      name: 'Haras del Pilar'       },
  { slug: 'pilara-magazine',       name: 'Pilará Magazine'        },
  { slug: 'los-lagartos',          name: 'Los Lagartos'           },
  { slug: 'campo-chico',           name: 'Campo Chico'            },
]

export function Footer() {
  return (
    <footer className="bg-dw-black border-t border-dw-border pt-10 pb-5 md:pt-16 md:pb-8 px-5 md:px-10">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8 mb-10 md:gap-12 md:mb-14">
        <div>
          <Image src="/logo-dework.png" alt="Dework" width={120} height={40} className="object-contain mb-4" />
          <p className="text-dw-muted text-xs leading-relaxed max-w-[200px]">
            Agencia de Diseño Editorial.<br />Pilar, Buenos Aires, Argentina.
          </p>
        </div>
        <div>
          <p className="text-dw-muted text-[10px] tracking-[0.22em] uppercase mb-5">Publicaciones</p>
          <div className="flex flex-col gap-2.5">
            {PUBS.map(p => (
              <Link key={p.slug} href={`/revistas/${p.slug}`}
                className="text-dw-muted text-sm hover:text-dw-text transition-colors duration-200">{p.name}</Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-dw-muted text-[10px] tracking-[0.22em] uppercase mb-5">Contacto</p>
          <div className="flex flex-col gap-2.5 text-dw-muted text-sm">
            <span>Info@dework.com.ar</span>
            <span>011 3361-6566</span>
            <div className="flex gap-6 mt-3">
              <a href="https://www.instagram.com/dework.arg/" target="_blank" rel="noopener noreferrer"
                className="hover:text-dw-text transition-colors">Instagram</a>
              <a href="https://www.facebook.com/dework.arg" target="_blank" rel="noopener noreferrer"
                className="hover:text-dw-text transition-colors">Facebook</a>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto border-t border-dw-border pt-6 md:pt-8">
        <p className="text-dw-muted text-xs">© 2026 Dework Editorial. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}
