import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { issueId, title, issueNumber, isPublished, clearRenders } = await req.json()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const updateData: Record<string, unknown> = {
    title,
    issue_number: issueNumber,
    is_published: isPublished,
  }

  // When clearRenders=true, wipe pre-rendered images so the reader uses client-side PDF.js
  if (clearRenders) {
    updateData.page_images_json = null
  }

  const { error } = await supabase.from('issues').update(updateData).eq('id', issueId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
