import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// This route ONLY uploads the file to Supabase Storage and returns the public URL.
// The DB update is done client-side (same pattern as togglePublish which works).
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const issueId  = formData.get('issueId') as string
    const file     = formData.get('file') as File | null

    if (!issueId || !file) {
      return NextResponse.json({ error: 'Missing issueId or file' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const ext    = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path   = `${issueId}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to Supabase Storage with service-role key
    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(path)

    return NextResponse.json({ ok: true, coverUrl: publicUrl })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}