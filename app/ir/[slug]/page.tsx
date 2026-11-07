import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import servicios from '@/data/sd-servicios.json'
import { Salida } from './Salida'

// Salida a cada anunciante: /ir/<anunciante> registra la visita (Vercel Web Analytics la cuenta como página vista)
// y enseguida abre su WhatsApp, su web o su Instagram. Así sabemos cuántos contactos le mandó la revista a cada uno.
type Servicio = { marca: string; whatsapp: string; imagen: string }
const lista = servicios as Servicio[]
const slugDe = (s: Servicio) => s.imagen.replace(/^\/servicios\//, '').replace(/\.webp$/, '')

export const metadata: Metadata = { robots: { index: false, follow: false } }

export function generateStaticParams() {
  return lista.map(s => ({ slug: slugDe(s) }))
}

export default async function IrPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = lista.find(x => slugDe(x) === slug)
  if (!s) notFound()
  return <Salida marca={s.marca} url={s.whatsapp} />
}
