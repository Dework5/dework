import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const formData = await req.formData()
    const issueId  = formData.get('issueId') as string
    const file     = formData.get('file') as File | null

    if (!issueId || !file) {
      return NextResponse.json({ error: 'Missing issueId or file' }, { status: 400 })
    }

    // Build a unique storage path
    const ext      = file.name.split('.').pop() || 'jpg'
    const path     = `covers/${issueId}-${Date.now()}.${ext}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    // Upload directly with service-role key — no signed URL needed
    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(path)

    // Update the DB
    const { error: dbError } = await supabase
      .from('issues')
      .update({ cover_url: publicUrl })
      .eq('id', issueId)

    if (dbError) {
      return NextResponse.json({ error: 'DB update failed: ' + dbError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, coverUrl: publicUrl })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}