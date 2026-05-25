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

    // Update cover_url in DB using service-role key (anon key is blocked by RLS)
    const { error: dbErr } = await supabase
      .from('issues')
      .update({ cover_url: publicUrl })
      .eq('id', issueId)

    if (dbErr) {
      console.error('[update-issue-cover] DB update failed:', dbErr.message)
    }

    // Look up the publication slug so we can purge the right ISR pages
    const { data: issue } = await supabase
      .from('issues')
      .select('issue_number, publications(slug)')
      .eq('id', issueId)
      .single()

    if (issue) {
      const pub = issue.publications as { slug: string } | null
      const slug = pub?.slug
      if (slug) {
        // Immediately invalidate ISR cache for all affected pages
        revalidatePath('/')                                          // home (hero cover)
        revalidatePath(`/revistas/${slug}`)                         // listing grid
        revalidatePath(`/revistas/${slug}/${issue.issue_number}`)   // reader page
      }
    }

    return NextResponse.json({ ok: true, coverUrl: publicUrl })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
