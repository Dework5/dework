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
