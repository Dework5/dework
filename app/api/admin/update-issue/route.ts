import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { issueId, title, issueNumber, isPublished, clearRenders, publicationSlug } = await req.json()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const updateData: Record<string, unknown> = {}
  if (title !== undefined)       updateData.title        = title
  if (issueNumber !== undefined)  updateData.issue_number = issueNumber
  if (isPublished !== undefined)  updateData.is_published = isPublished
  if (clearRenders)               updateData.page_images_json = null

  const { error } = await supabase.from('issues').update(updateData).eq('id', issueId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Revalidate the reader page so Next.js drops its cached RSC payload
  revalidatePath('/revistas', 'layout')
  if (publicationSlug && issueNumber) {
    revalidatePath(`/revistas/${publicationSlug}/${issueNumber}`)
  }

  return NextResponse.json({ ok: true })
}
