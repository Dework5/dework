import Link from 'next/link'
import { Mail, Phone, MapPin } from 'lucide-react'

const publications = [
  { slug: 'san-diego-la-revista', name: 'San Diego La Revista' },
  { slug: 'haras-del-pilar', name: 'Haras del Pilar' },
  { slug: 'pilara-magazine', name: 'Pilará Magazine' },
  { slug: 'los-lagartos', name: 'Los Lagartos' },
  { slug: 'campo-chico', name: 'Campo Chico' },
]

export function Footer() {
  return (
    <footer className="bg-surface border-t border-border">
      <div className="max-w-content mx-auto px-4 md:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {/* Col 1: Logo + descripción */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-1 group w-fit">
              <span className="text-primary text-xl font-bold">•</span>
              <span className="font-display font-bold text-xl text-text-primary tracking-wider">
                DEWORK
              </span>
            </Link>
            <p className="text-text-secondary text-sm font-body leading-relaxed max-w-xs">
              Agencia de Diseño Editorial. Pilar, Buenos Aires, Argentina.
            </p>
          </div>

          {/* Col 2: Publicaciones */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-text-primary text-sm uppercase tracking-widest">
              Publicaciones
            </h3>
            <ul className="space-y-2">
              {publications.map((pub) => (
                <li key={pub.slug}>
                  <Link
                    href={`/revistas/${pub.slug}`}
                    className="text-text-secondary hover:text-text-primary transition-colors text-sm font-body"
                  >
                    {pub.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Contacto */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-text-primary text-sm uppercase tracking-widest">
              Contacto
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:Info@dework.com.ar"
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-body"
                >
                  <Mail size={14} />
                  Info@dework.com.ar
                </a>
              </li>
              <li>
                <a
                  href="tel:+5401133616566"
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-body"
                >
                  <Phone size={14} />
                  011 3361-6566
                </a>
              </li>
              <li className="flex items-center gap-2 text-text-secondary text-sm font-body">
                <MapPin size={14} />
                Pilar, Buenos Aires
              </li>
            </ul>
            <div className="flex items-center gap-4 pt-2">
              <a
                href="https://www.instagram.com/dework.arg/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-primary transition-colors text-sm font-body"
                aria-label="Instagram"
              >
                IG
              </a>
              <a
                href="https://www.facebook.com/dework.arg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-primary transition-colors text-sm font-body"
                aria-label="Facebook"
              >
                FB
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-text-muted text-xs font-body text-center">
            © {new Date().getFullYear()} Dework. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
