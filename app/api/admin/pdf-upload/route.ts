export const runtime = 'edge'

export async function POST(req: Request) {
  const pw = req.headers.get('x-dw-admin')
  if (pw !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD!) {
    return new Response('Unauthorized', { status: 401 })
  }

  const path = req.headers.get('x-pdf-path') || ''
  if (!path) return new Response('Missing x-pdf-path header', { status: 400 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const init: RequestInit & { duplex?: string } = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/pdf',
      'Cache-Control': '3600',
      'x-upsert': 'true',
    },
    body: req.body,
    duplex: 'half',
  }

  const res = await fetch(`${supabaseUrl}/storage/v1/object/pdfs/${path}`, init)
  if (!res.ok) return new Response(await res.text(), { status: res.status })
  return Response.json({ url: `${supabaseUrl}/storage/v1/object/public/pdfs/${path}` })
}
