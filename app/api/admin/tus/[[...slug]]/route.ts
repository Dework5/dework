export const runtime = 'nodejs'

const TUS_BASE = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`
const SVC_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_PW = () => process.env.NEXT_PUBLIC_ADMIN_PASSWORD!
const PROXY_BASE = '/api/admin/tus'

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const slug = url.pathname.replace(/^.*\/api\/admin\/tus/, '')

  if (req.method === 'POST' && slug === '') {
    const pw = req.headers.get('x-dw-admin')
    if (pw !== ADMIN_PW()) return new Response('Unauthorized', { status: 401 })
  }

  const target = `${TUS_BASE()}${slug}${url.search}`

  const headers = new Headers()
  for (const [k, v] of req.headers.entries()) {
    const lk = k.toLowerCase()
    if (lk === 'host' || lk === 'x-dw-admin') continue
    headers.set(k, v)
  }
  headers.set('authorization', `Bearer ${SVC_KEY()}`)

  let body: ArrayBuffer | undefined
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    body = await req.arrayBuffer()
  }

  let upstream: Response
  try {
    upstream = await fetch(target, { method: req.method, headers, body })
  } catch (err) {
    return new Response(`Proxy fetch error: ${err}. Target: ${target}`, { status: 502 })
  }

  const resHeaders = new Headers()
  for (const [k, v] of upstream.headers.entries()) {
    if (k.toLowerCase() === 'location') {
      const marker = '/upload/resumable/'
      const idx = v.indexOf(marker)
      resHeaders.set('location', idx >= 0
        ? `${PROXY_BASE}/${v.slice(idx + marker.length)}`
        : v
      )
    } else {
      resHeaders.set(k, v)
    }
  }

  if (upstream.status === 404) {
    const upstreamText = await upstream.text()
    return new Response(
      `${upstreamText} [target:${target}]`,
      { status: 404, headers: resHeaders }
    )
  }

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders })
}

export const GET = handler; export const HEAD = handler; export const POST = handler
export const PATCH = handler; export const OPTIONS = handler; export const DELETE = handler
