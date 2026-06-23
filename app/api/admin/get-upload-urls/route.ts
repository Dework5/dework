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

  // Ensure covers bucket exists and is public (createBucket is a no-op if already exists)
  await supabase.storage.createBucket('covers', {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
  await supabase.storage.updateBucket('covers', {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })

  const timestamp = Date.now()
  const coverPath = `${publicationId}/${issueNumber}-${timestamp}.${coverExt || 'jpg'}`
  const pdfPath   = `${publicationId}/${issueNumber}-${timestamp}.pdf`

  // Only cover goes to Supabase — PDFs go to R2 (no size limit, no Supabase pdfs bucket needed)
  const coverResult = await supabase.storage.from('covers').createSignedUploadUrl(coverPath)

  if (coverResult.error) {
    return NextResponse.json({ error: coverResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    cover: { signedUrl: coverResult.data.signedUrl, token: coverResult.data.token, path: coverPath },
    pdf:   { path: pdfPath },
  })
}
