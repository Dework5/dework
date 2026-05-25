import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { publicationId, issueNumber, title, coverPath, pdfPath, isPublished } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: coverPublic } = supabase.storage.from('covers').getPublicUrl(coverPath)
  const { data: pdfPublic }   = supabase.storage.from('pdfs').getPublicUrl(pdfPath)

  const { data: issue, error: dbError } = await supabase
    .from('issues')
    .insert({
      publication_id: publicationId,
      issue_number:   issueNumber,
      title,
      cover_url:      coverPublic.publicUrl,
      pdf_url:        pdfPublic.publicUrl,
      is_published:   isPublished,
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const { data: pub } = await supabase
    .from('publications')
    .select('slug')
    .eq('id', publicationId)
    .single()

  const url = pub ? `/revistas/${pub.slug}/${issueNumber}` : null
  return NextResponse.json({ ok: true, issue, url })
}
