import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { issueId, isPublished } = await req.json()
    if (!issueId || typeof isPublished !== 'boolean') {
      return NextResponse.json({ error: 'Missing issueId or isPublished' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('issues')
      .update({ is_published: isPublished })
      .eq('id', issueId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Purge ISR cache: two simple queries, no join syntax
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
      // Revalidation is best-effort — don't fail the publish toggle if this errors
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
