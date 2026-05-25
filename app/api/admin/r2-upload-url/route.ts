import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'

// Generar URL firmada para subir PDF directo al bucket R2 de Cloudflare.
// R2 no tiene limite de tamanio por archivo (hasta 5GB con PUT simple).
// Las credenciales nunca salen del servidor.

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: 'path requerido' }, { status: 400 })

  const accountId       = process.env.R2_ACCOUNT_ID!
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID!
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket          = process.env.R2_BUCKET_NAME || 'dework-pdfs'
  const publicUrl       = process.env.R2_PUBLIC_URL!   // ej: https://pub-xxx.r2.dev

  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
    return NextResponse.json({ error: 'R2 no configurado (faltan env vars)' }, { status: 500 })
  }

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  const signedUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket:      bucket,
      Key:         path,
      ContentType: 'application/pdf',
    }),
    { expiresIn: 3600 }  // URL valida por 1 hora
  )

  const fileUrl = `${publicUrl.replace(/\/$/, '')}/${path}`

  return NextResponse.json({ signedUrl, fileUrl })
}