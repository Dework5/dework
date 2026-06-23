import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // pdfUrl: URL publica directa (R2) o pdfPath: path en Supabase Storage (legacy)
  const { publicationId, issueNumber, title, coverPath, pdfUrl, pdfPath, isPublished } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Ensure pdfs bucket exists and is public
  await supabase.storage.createBucket('pdfs', { public: true }).catch(() => {})
  await supabase.storage.updateBucket('pdfs', { public: true }).catch(() => {})

  const { data: coverPublic } = supabase.storage.from('covers').getPublicUrl(coverPath)

  // pdfUrl (R2 public URL) is required; pdfPath is legacy fallback for old Supabase uploads
  let resolvedPdfUrl = pdfUrl
  if (!resolvedPdfUrl && pdfPath) {
    const { data: pdfPublic } = supabase.storage.from('pdfs').getPublicUrl(pdfPath)
    resolvedPdfUrl = pdfPublic.publicUrl
  }
  if (!resolvedPdfUrl) {
    return NextResponse.json({ error: 'PDF URL es requerida' }, { status: 400 })
  }

  const { data: issue, error: dbError } = await supabase
    .from('issues')
    .upsert({
      publication_id: publicationId,
      issue_number:   issueNumber,
      title,
      cover_url:      coverPublic.publicUrl,
      pdf_url:        resolvedPdfUrl,
      is_published:   isPublished,
    }, { onConflict: 'publication_id,issue_number', ignoreDuplicates: false })
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

  // Purge ISR cache immediately so the new issue appears without waiting
  if (pub?.slug) {
    revalidatePath('/')
    revalidatePath(`/revistas/${pub.slug}`)
    revalidatePath(`/revistas/${pub.slug}/${issueNumber}`)
  }

  // Fire-and-forget: trigger server-side page pre-rendering automatically
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`
    fetch(`${baseUrl}/api/render-issue`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '',
      },
      body: JSON.stringify({ issueId: issue.id }),
    }).catch(() => {}) // errors are silent — user can retry from admin
  } catch { /* silent */ }

  return NextResponse.json({ ok: true, issue, url })
}
