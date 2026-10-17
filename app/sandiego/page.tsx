import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'

// dework.com.ar/sandiego -> siempre la última edición publicada de San Diego La Revista.
// Es la dirección corta y fija que se comparte por WhatsApp e impresa en la revista (QR).
export const dynamic = 'force-dynamic'

export default async function SanDiegoUltima() {
  const db = createServerClient()
  const { data: pub } = await db.from('publications').select('id').eq('slug', 'san-diego-la-revista').single()
  const { data: issue } = pub
    ? await db.from('issues').select('issue_number').eq('publication_id', pub.id).eq('is_published', true)
        .order('issue_number', { ascending: false }).limit(1).single()
    : { data: null }
  redirect(issue ? `/revistas/san-diego-la-revista/${issue.issue_number}` : '/revistas/san-diego-la-revista')
}
