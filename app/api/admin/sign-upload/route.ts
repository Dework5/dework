export const runtime = 'edge'

export async function POST(req: Request) {
  const pw = req.headers.get('x-dw-admin')
  if (pw !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD!) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { path } = await req.json()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/upload/sign/pdfs/${path}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}` },
    }
  )

  if (!res.ok) {
    const text = await res.text()
    return new Response(text, { status: res.status })
  }

  const data = await res.json()
  // Supabase may return relative URL — always return absolute
  const rawUrl: string = data.url ?? data.signedURL ?? ''
  const uploadUrl = rawUrl.startsWith('http') ? rawUrl : `${supabaseUrl}${rawUrl}`

  return Response.json({ uploadUrl })
}
