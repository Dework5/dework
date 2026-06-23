export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  const isTrusted =
    (url.startsWith('https://pub-') && url.includes('.r2.dev/')) ||
    url.includes('.supabase.co/storage/')
  if (!isTrusted) return new Response('Forbidden', { status: 403 })

  const range = request.headers.get('range')
  const upstreamHeaders: Record<string, string> = {}
  if (range) upstreamHeaders['range'] = range

  const upstream = await fetch(url, { headers: upstreamHeaders })
  if (!upstream.ok && upstream.status !== 206)
    return new Response('Upstream error', { status: upstream.status })

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*',
  }

  for (const h of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const v = upstream.headers.get(h)
    if (v) responseHeaders[h] = v
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
