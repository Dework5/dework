import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { issueId, sessionId } = await req.json()

    if (!issueId || !sessionId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Evitar contar la misma sesión dos veces para la misma edición
    const { data: existing } = await supabase
      .from('issue_views')
      .select('id')
      .eq('issue_id', issueId)
      .eq('session_id', sessionId)
      .single()

    if (!existing) {
      await supabase.from('issue_views').insert({ issue_id: issueId, session_id: sessionId })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
