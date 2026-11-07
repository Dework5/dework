'use client'

import { useEffect } from 'react'
import { setSecciones, type Seccion } from '@/components/layout/seccionesStore'

interface Props {
  secciones: Seccion[]
}

// Declara las secciones de la página: se muestran en la barra de arriba (Navbar), no como botón aparte.
export function SeccionesMenu({ secciones }: Props) {
  useEffect(() => {
    setSecciones(secciones)
    return () => setSecciones([])
  }, [JSON.stringify(secciones)]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al llegar desde otra página con #seccion en el link, ir a esa sección una vez cargada la página
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView(), 300)
    return () => clearTimeout(t)
  }, [])

  return null
}
