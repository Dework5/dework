import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { publicationId, issueNumber, coverExt } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── Auto-crear buckets si no existen (idempotente) ──────────────────────
  await Promise.all([
    supabase.storage.createBucket('covers', { public: true, allowedMimeTypes: ['image/jpeg','image/png','image/webp'] }),
    supabase.storage.createBucket('pdfs',   { public: true, allowedMimeTypes: ['application/pdf'] }),
  ])
  // Los errores "already exists" se ignoran — solo nos importa que existan

  const timestamp = Date.now()
  const coverPath = `${publicationId}/${issueNumber}-${timestamp}.${coverExt || 'jpg'}`
  const pdfPath   = `${publicationId}/${issueNumber}-${timestamp}.pdf`

  const [coverResult, pdfResult] = await Promise.all([
    supabase.storage.from('covers').createSignedUploadUrl(coverPath),
    supabase.storage.from('pdfs').createSignedUploadUrl(pdfPath),
  ])

  if (coverResult.error || pdfResult.error) {
    return NextResponse.json(
      { error: coverResult.error?.message || pdfResult.error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    cover: { signedUrl: coverResult.data.signedUrl, token: coverResult.data.token, path: coverPath },
    pdf:   { signedUrl: pdfResult.data.signedUrl,   token: pdfResult.data.token,   path: pdfPath   },
  })
}
