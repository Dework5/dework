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

    // Look up publication slug to purge the right pages
    const { data: issue } = await supabase
      .from('issues')
      .select('issue_number, publications(slug)')
      .eq('id', issueId)
      .single()

    if (issue) {
      const pub = issue.publications as { slug: string } | null
      const slug = pub?.slug
      if (slug) {
        revalidatePath('/')
        revalidatePath(`/revistas/${slug}`)
        revalidatePath(`/revistas/${slug}/${issue.issue_number}`)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
