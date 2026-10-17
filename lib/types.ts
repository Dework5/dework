/** Stored in issues.page_images_json after server-side pre-rendering */
export interface PreRenderedImages {
  isSpreadPDF: boolean
  isAllSpread: boolean
  /** Original PDF page dimensions (one magazine page, not a spread) */
  pageDimensions: { w: number; h: number }
  /** Total number of PDF pages */
  totalPdfPages: number
  /**
   * Slot URL map.
   * Keys: "1" for portrait pages, "2_L" / "2_R" for landscape-spread halves.
   * Values: public Supabase Storage URLs.
   */
  slots: Record<string, string>
  /** Pages that failed to render or produced a suspiciously small output (FIX 10) */
  errorPages?: number[]
  /**
   * Zonas clickeables por página (clave = número de página). x/y/w/h en fracción (0-1) de la página.
   * `page` lleva a otra página de la revista; `url` abre un link externo (web, WhatsApp, Instagram).
   */
  links?: Record<string, Array<{ x: number; y: number; w: number; h: number; page?: number; url?: string; title?: string }>>
  /** Notas de la edición para el modo lectura (texto con letra de celular). Si no hay, el visor no muestra el botón. */
  notas?: Nota[]
}

export type BloqueNota = string | { h: string } | { li: string } | { foto: string; pie?: string } | { cita: string } | { firma: string } | { servicio: string[] }

export interface Nota {
  id: string
  /** Páginas que ocupa en la revista (inclusive) */
  desde: number
  hasta: number
  seccion?: string
  titulo: string
  tituloCursiva?: string
  bajada?: string
  /** Foto de apertura */
  foto?: string
  /** Texto del botón en el visor (por defecto "Leer la nota"), p. ej. "Ver servicios" */
  etiqueta?: string
  cuerpo: BloqueNota[]
}

export interface Publication {
  id: string
  slug: string
  name: string
  short_name: string
  description: string | null
  accent_color: string
  is_active: boolean
  created_at: string
}

export interface Issue {
  id: string
  publication_id: string
  issue_number: number
  title: string
  cover_url: string
  pdf_url: string
  page_count: number
  is_published: boolean
  published_at: string
  created_at: string
  page_images_json?: PreRenderedImages | null
  images_status?: 'pending' | 'processing' | 'ready' | 'partial_error'
  page_texts_json?: Record<string, string> | null
  publication?: Publication
}

export interface IssueView {
  id: string
  issue_id: string
  session_id: string
  created_at: string
}

export interface PageView {
  id: string
  issue_id: string
  session_id: string
  page_number: number
  created_at: string
}

export interface PublicationWithLatestIssue extends Publication {
  latest_issue?: Issue | null
}
