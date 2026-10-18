import Link from 'next/link'
import type { PreRenderedImages } from '@/lib/types'

interface Props {
  issue: any
  slug: string
  publicationName: string
}

// Última edición destacada arriba de todo: tapa grande con marco dorado, mes, notas y "Leer ahora".
export function UltimaEdicion({ issue, slug, publicationName }: Props) {
  const pij = issue.page_images_json as PreRenderedImages | null
  const mes = pij?.compartir?.mes
  const notas = (pij?.notas ?? []).filter(n => n.id !== 'servicios').slice(0, 5)
  const href = `/revistas/${slug}/${issue.issue_number}`
  const tapa = pij?.slots?.['1']?.replace(/-1600\.webp$/, '-800.webp') ?? issue.cover_url

  return (
    <section className="bg-[#16362B] text-[#F4EFE4] px-5 md:px-12 py-12 md:py-20">
      <div className="max-w-6xl mx-auto grid md:grid-cols-[minmax(0,420px)_1fr] gap-10 md:gap-16 items-center">
        <Link href={href} className="group block mx-auto w-[72%] sm:w-[55%] md:w-full">
          <div className="aspect-[210/297] relative outline outline-1 outline-[#B08D57] outline-offset-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden">
            {tapa && <img src={tapa} alt={`${publicationName} · Edición ${issue.issue_number}`} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
          </div>
        </Link>

        <div>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[#D9C29A] text-[11px] tracking-[0.32em] uppercase">Última edición</span>
            <span className="h-px w-12 bg-[#B08D57]" />
          </div>
          <h2 className="font-display font-normal leading-[1.02]" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
            Edición n° {issue.issue_number}
            {mes && <><br /><i className="text-[#D9C29A]">{mes}</i></>}
          </h2>

          {notas.length > 0 && (
            <div className="mt-8 md:mt-10">
              <p className="text-[#D9C29A] text-[10px] tracking-[0.3em] uppercase mb-3">En esta edición</p>
              <ul>
                {notas.map(n => (
                  <li key={n.id} className="border-b border-[#B08D57]/35">
                    <Link href={`${href}?nota=${n.id}`} className="flex items-baseline gap-4 py-3 hover:text-[#D9C29A] transition-colors">
                      <span className="font-display text-[#B08D57] text-lg w-8 shrink-0">{n.desde}</span>
                      <span className="font-display text-lg md:text-xl leading-snug">
                        {n.titulo}{n.tituloCursiva && <> <i className="text-[#D9C29A]">{n.tituloCursiva}</i></>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-9">
            <Link href={href} className="bg-[#B08D57] text-[#F4EFE4] text-[11px] tracking-[0.22em] uppercase px-9 py-4 hover:bg-[#9a7a49] transition-colors">
              Leer ahora →
            </Link>
            {issue.pdf_url && (
              <a href={issue.pdf_url} target="_blank" rel="noopener noreferrer" className="text-[#EAE2CF] text-[11px] tracking-[0.2em] uppercase border-b border-[#B08D57] pb-px hover:text-[#F4EFE4]">
                Descargar PDF
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
