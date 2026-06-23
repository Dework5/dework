export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) return new Response('Missing url', { status: 400 })

  const isTrusted =
    url.startsWith('https://pub-') && url.includes('.r2.dev/') ||
    url.includes('.supabase.co/storage/')

  if (!isTrusted) return new Response('Forbidden', { status: 403 })

  const upstream = await fetch(url)
  if (!upstream.ok) return new Response('Upstream error', { status: upstream.status })

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
