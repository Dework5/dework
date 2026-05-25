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
