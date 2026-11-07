'use client'

import { useSyncExternalStore } from 'react'

// Secciones de la página actual: cada página las declara con <SeccionesMenu secciones={…} /> y la barra de arriba las muestra.
export type Seccion = [href: string, label: string]
const VACIO: Seccion[] = []
let actuales: Seccion[] = VACIO
const oyentes = new Set<() => void>()

export function setSecciones(s: Seccion[]) {
  actuales = s.length ? s : VACIO
  oyentes.forEach(f => f())
}

export function useSecciones(): Seccion[] {
  return useSyncExternalStore(
    f => { oyentes.add(f); return () => { oyentes.delete(f) } },
    () => actuales,
    () => VACIO,
  )
}
