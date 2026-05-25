import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

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
    const storagePath = `${issueId}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to Supabase Storage with service-role key
    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(storagePath)

    // Update cover_url in DB using service-role key (anon key is blocked by RLS)
    const { error: dbErr } = await supabase
      .from('issues')
      .update({ cover_url: publicUrl })
      .eq('id', issueId)

    if (dbErr) {
      console.error('[update-issue-cover] DB update failed:', dbErr.message)
    }

    // Purge ISR cache: look up publication slug via two simple queries (no join)
    try {
      const { data: issueRow } = await supabase
        .from('issues')
        .select('issue_number, publication_id')
        .eq('id', issueId)
        .single()

      if (issueRow?.publication_id) {
        const { data: pubRow } = await supabase
          .from('publications')
          .select('slug')
          .eq('id', issueRow.publication_id)
          .single()

        if (pubRow?.slug) {
          revalidatePath('/')
          revalidatePath(`/revistas/${pubRow.slug}`)
          revalidatePath(`/revistas/${pubRow.slug}/${issueRow.issue_number}`)
        }
      }
    } catch {
      // Revalidation is best-effort — don't fail the upload if this errors
    }

    return NextResponse.json({ ok: true, coverUrl: publicUrl })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
