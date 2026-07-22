/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/extract-text
 * Extracts text from PDF pages using pdfjs getTextContent().
 * Batches 10 pages per invocation to stay within Vercel Hobby's 10s limit.
 * Self-chains until all pages are done; stores result in issues.page_texts_json.
 */

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

const PAGES_PER_CALL = 10

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth || auth !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { issueId, startPage = 1 } = await req.json() as { issueId?: string; startPage?: number }
    if (!issueId) return NextResponse.json({ error: 'Missing issueId' }, { status: 400 })

    const { createServerClient } = await import('@/lib/supabase-server')
    const db = createServerClient()

    const { data: issue, error: dbErr } = await db
      .from('issues')
      .select('id, pdf_url, page_texts_json')
      .eq('id', issueId)
      .single()

    if (dbErr || !issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    const pdfRes = await fetch(issue.pdf_url, { cache: 'no-store' })
    if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`)
    const pdfBuffer = new Uint8Array(await pdfRes.arrayBuffer())

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js')
    await import('pdfjs-dist/legacy/build/pdf.worker.js')

    const doc = await (pdfjsLib as any).getDocument({
      data:           pdfBuffer,
      isEvalSupported: false,
      useSystemFonts:  true,
      disableRange:    true,
      disableStream:   true,
    }).promise

    const totalPdfPages = doc.numPages
    const batchEnd      = Math.min(startPage + PAGES_PER_CALL - 1, totalPdfPages)

    // Merge with any previously extracted pages
    const existing: Record<string, string> = startPage === 1 ? {} : ((issue.page_texts_json as any) || {})
    const texts: Record<string, string>    = { ...existing }

    for (let n = startPage; n <= batchEnd; n++) {
      const page    = await doc.getPage(n)
      const content = await page.getTextContent()
      const text    = content.items
        .filter((item: any) => typeof item.str === 'string' && item.str.trim())
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (text) texts[String(n)] = text
    }

    const done = batchEnd >= totalPdfPages

    const { error: updateErr } = await db.from('issues').update({ page_texts_json: texts }).eq('id', issueId)
    if (updateErr) throw new Error(updateErr.message)

    // Self-chain next batch before returning
    if (!done) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${process.env.PORT || 3000}`
      fetch(`${baseUrl}/api/extract-text`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '' },
        body:    JSON.stringify({ issueId, startPage: batchEnd + 1 }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, pagesExtracted: batchEnd - startPage + 1, totalPdfPages, nextStartPage: done ? null : batchEnd + 1, done })
  } catch (err: any) {
    console.error('[extract-text]', err?.message ?? err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
