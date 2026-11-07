'use client'

import { useEffect } from 'react'

// Muestra "Abriendo…" un instante (lo justo para que se registre la visita) y lleva al anunciante.
export function Salida({ marca, url }: { marca: string; url: string }) {
  const esWa = url.includes('wa.me/')
  useEffect(() => {
    const t = setTimeout(() => window.location.replace(url), 600)
    return () => clearTimeout(t)
  }, [url])
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-dw-black">
      <p className="text-dw-gold text-[10px] tracking-[0.35em] uppercase mb-4">San Diego La Revista · Recomendados</p>
      <p className="font-display text-3xl md:text-4xl text-dw-white mb-6">{marca}</p>
      <p className="text-dw-sub text-sm mb-8">{esWa ? 'Abriendo WhatsApp…' : 'Abriendo…'}</p>
      <a href={url} className="text-dw-gold text-[11px] tracking-[0.25em] uppercase underline-offset-4 hover:underline">
        Si no se abre, tocá acá →
      </a>
    </main>
  )
}
