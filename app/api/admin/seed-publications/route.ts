import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const PUBLICATIONS = [
  {
    slug: 'san-diego-la-revista',
    name: 'San Diego La Revista',
    short_name: 'SDLR',
    description: 'La revista exclusiva del country San Diego. Edición mensual desde 2014.',
    is_active: true,
  },
  {
    slug: 'haras-del-pilar',
    name: 'Haras del Pilar',
    short_name: 'HDP',
    description: 'La revista del mundo ecuestre y country de Pilar.',
    is_active: true,
  },
  {
    slug: 'pilara-magazine',
    name: 'Pilará Magazine',
    short_name: 'PM',
    description: 'Moda, cultura y tendencias de Pilará y alrededores.',
    is_active: true,
  },
  {
    slug: 'los-lagartos',
    name: 'Los Lagartos',
    short_name: 'LL',
    description: 'Revista del country Los Lagartos.',
    is_active: true,
  },
  {
    slug: 'campo-chico',
    name: 'Campo Chico',
    short_name: 'CC',
    description: 'La vida en el campo chico de zona norte.',
    is_active: true,
  },
]

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
  if (authHeader !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('publications')
    .upsert(PUBLICATIONS, { onConflict: 'slug' })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, publications: data })
}
