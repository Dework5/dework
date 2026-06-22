import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  // Verificar autorización
  const authHeader = req.headers.get('authorization')
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''

  if (authHeader !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const publicationId = formData.get('publicationId') as string
    const issueNumber = parseInt(formData.get('issueNumber') as string)
    const title = formData.get('title') as string
    const coverFile = formData.get('cover') as File
    const pdfFile = formData.get('pdf') as File
    const isPublished = formData.get('isPublished') === 'true'

    if (!publicationId || !issueNumber || !title || !coverFile || !pdfFile) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const timestamp = Date.now()

    // Subir portada
    const coverBuffer = await coverFile.arrayBuffer()
    const coverExt = coverFile.name.split('.').pop() || 'jpg'
    const coverPath = `${publicationId}/${issueNumber}-${timestamp}.${coverExt}`

    const { error: coverError } = await supabase.storage
      .from('covers')
      .upload(coverPath, coverBuffer, {
        contentType: coverFile.type,
        upsert: true,
      })

    if (coverError) {
      return NextResponse.json({ error: `Error subiendo portada: ${coverError.message}` }, { status: 500 })
    }

    // Subir PDF
    const pdfBuffer = await pdfFile.arrayBuffer()
    const pdfPath = `${publicationId}/${issueNumber}-${timestamp}.pdf`

    const { error: pdfError } = await supabase.storage
      .from('pdfs')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (pdfError) {
      return NextResponse.json({ error: `Error subiendo PDF: ${pdfError.message}` }, { status: 500 })
    }

    // Obtener URLs públicas
    const { data: coverPublic } = supabase.storage.from('covers').getPublicUrl(coverPath)
    const { data: pdfPublic } = supabase.storage.from('pdfs').getPublicUrl(pdfPath)

    // Insertar en la base de datos
    const { data: issue, error: dbError } = await supabase
      .from('issues')
      .insert({
        publication_id: publicationId,
        issue_number: issueNumber,
        title,
        cover_url: coverPublic.publicUrl,
        pdf_url: pdfPublic.publicUrl,
        is_published: isPublished,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: `Error guardando edición: ${dbError.message}` }, { status: 500 })
    }

    // Obtener el slug de la publicación para construir la URL
    const { data: pub } = await supabase
      .from('publications')
      .select('slug')
      .eq('id', publicationId)
      .single()

    const url = pub ? `/revistas/${pub.slug}/${issueNumber}` : null

    return NextResponse.json({ ok: true, issue, url })
  } catch (err) {
    return NextResponse.json(
      { error: `Error inesperado: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
