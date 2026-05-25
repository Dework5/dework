// Proxy Edge para subida TUS — reenvía chunks de pdfjs al endpoint TUS de Supabase
// usando la service_role key del servidor.  Funciona para archivos de cualquier tamanio
// (cada chunk de 6 MB está muy por debajo del límite de 25 MB de Edge Functions).

export const runtime = 'edge'

const TUS_BASE   = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`
const SVC_KEY    = () => process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_PW   = () => process.env.NEXT_PUBLIC_ADMIN_PASSWORD!
const PROXY_BASE = '/api/admin/tus'

async function handler(req: Request): Promise<Response> {
  const url  = new URL(req.url)
  const slug = url.pathname.replace(/^.*\/api\/admin\/tus/, '') // '' o '/pdfs/...'

  // Verificar contraseña solo en la creación del upload (POST sin slug)
  if (req.method === 'POST' && slug === '') {
    const pw = req.headers.get('x-dw-admin')
    if (pw !== ADMIN_PW()) return new Response('Unauthorized', { status: 401 })
  }

  const target = `${TUS_BASE()}${slug}${url.search}`

  // Copiar headers, agregar service_role, limpiar los propios
  const headers = new Headers()
  for (const [k, v] of req.headers.entries()) {
    const lk = k.toLowerCase()
    if (lk === 'host' || lk === 'x-dw-admin') continue
    headers.set(k, v)
  }
  headers.set('authorization', `Bearer ${SVC_KEY()}`)

  // Armar request hacia Supabase
  const init: RequestInit & { duplex?: string } = { method: req.method, headers }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    init.body   = req.body
    init.duplex = 'half'
  }

  const upstream = await fetch(target, init)

  // Reescribir header Location para que el cliente siga usando nuestro proxy
  const resHeaders = new Headers()
  for (const [k, v] of upstream.headers.entries()) {
    resHeaders.set(k, k.toLowerCase() === 'location'
      ? v.replace(TUS_BASE(), PROXY_BASE)
      : v
    )
  }

  return new Response(upstream.body, {
    status:  upstream.status,
    headers: resHeaders,
  })
}

export const GET     = handler
export const HEAD    = handler
export const POST    = handler
export const PATCH   = handler
export const OPTIONS = handler
export const DELETE  = handler