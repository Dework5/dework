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
    <footer className="bg-[#16362B] pt-10 pb-5 md:pt-16 md:pb-8 px-5 md:px-10">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8 mb-10 md:gap-12 md:mb-14">
        <div>
          <Image src="/logo-dework-recorte.png" alt="Dework" width={600} height={153} className="h-12 md:h-14 w-auto object-contain mb-5" unoptimized />
          <p className="text-[#EAE2CF]/80 text-xs leading-relaxed max-w-[200px]">
            Agencia de Diseño Editorial.<br />Pilar, Buenos Aires, Argentina.
          </p>
        </div>
        <div>
          <p className="text-[#D9C29A] text-[10px] tracking-[0.22em] uppercase mb-5">Publicaciones</p>
          <div className="flex flex-col gap-2.5">
            {PUBS.map(p => (
              <Link key={p.slug} href={`/revistas/${p.slug}`}
                className="text-[#EAE2CF]/80 text-sm hover:text-[#F4EFE4] transition-colors duration-200">{p.name}</Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[#D9C29A] text-[10px] tracking-[0.22em] uppercase mb-5">Contacto</p>
          <div className="flex flex-col gap-2.5 text-[#EAE2CF]/80 text-sm">
            <span>Info@dework.com.ar</span>
            <span>011 3361-6566</span>
            <div className="flex gap-6 mt-3">
              <a href="https://www.instagram.com/countrysandiegolarevista/?hl=es" target="_blank" rel="noopener noreferrer"
                className="hover:text-[#F4EFE4] transition-colors">Instagram</a>
              <a href="https://www.facebook.com/dework.arg" target="_blank" rel="noopener noreferrer"
                className="hover:text-[#F4EFE4] transition-colors">Facebook</a>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto border-t border-[#B08D57]/40 pt-6 md:pt-8">
        <p className="text-[#EAE2CF]/80 text-xs">© 2026 Dework Editorial. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}
