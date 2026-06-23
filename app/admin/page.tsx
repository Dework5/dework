'use client'

import { useState, useEffect, useRef } from 'react'
import { AdminLogin } from '@/components/admin/AdminLogin'
import { UploadForm } from '@/components/admin/UploadForm'
import { supabase } from '@/lib/supabase'
import { Publication, Issue } from '@/lib/types'
import { Eye, EyeOff, Camera, Check, Pencil, Trash2, X } from 'lucide-react'

type Tab = 'upload' | 'stats' | 'issues'

const PUBLICATIONS_SIDEBAR = [
  { slug: 'san-diego-la-revista', name: 'San Diego La Revista', shortName: 'SDLR', issueCount: 0 },
  { slug: 'haras-del-pilar',      name: 'Haras del Pilar',       shortName: 'HDP',  issueCount: 0 },
  { slug: 'pilara-magazine',      name: 'Pilará Magazine',        shortName: 'PM',   issueCount: 0 },
  { slug: 'los-lagartos',         name: 'Los Lagartos',           shortName: 'LL',   issueCount: 0 },
  { slug: 'campo-chico',          name: 'Campo Chico',            shortName: 'CC',   issueCount: 0 },
]

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('upload')
  const [publications, setPublications] = useState<Publication[]>([])
  const [pubsLoading, setPubsLoading] = useState(false)
  const [issues, setIssues] = useState<(Issue & { views?: number })[]>([])
  const [selectedPub, setSelectedPub] = useState('')
  const [selectedIssue, setSelectedIssue] = useState('')
  const [stats, setStats] = useState<{ totalViews: number; topPages: { page_number: number; count: number }[] } | null>(null)
  const [coverUpdating, setCoverUpdating] = useState<Record<string, boolean>>({})
  const [coverDone, setCoverDone] = useState<Record<string, boolean>>({})
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const coverInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [editIssue, setEditIssue] = useState<(Issue & { views?: number }) | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNumber, setEditNumber] = useState('')
  const [editPublished, setEditPublished] = useState(true)
  const [editSaving, setEditSaving] = useState(false)
  const [deleting,     setDeleting]     = useState<Record<string, boolean>>({})
  const [rendering,    setRendering]    = useState<Record<string, boolean>>({})
  const [renderResult, setRenderResult] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [showMigrationSQL, setShowMigrationSQL] = useState(false)

  useEffect(() => {
    const auth = sessionStorage.getItem('adminAuth')
    if (auth === 'true') setIsAuth(true)
  }, [])

  useEffect(() => {
    if (!isAuth) return
    setPubsLoading(true)
    const loadPublications = async () => {
      const { data } = await supabase.from('publications').select('*').order('created_at', { ascending: true })
      if (data && data.length > 0) {
        setPublications(data)
        setPubsLoading(false)
      } else {
        try {
          const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
          const res = await fetch('/api/admin/seed-publications', { method: 'POST', headers: { Authorization: pw } })
          if (res.ok) { const json = await res.json(); if (json.publications) setPublications(json.publications) }
        } catch { /* silent */ }
        setPubsLoading(false)
      }
    }
    loadPublications()
  }, [isAuth])

  useEffect(() => {
    if (!isAuth) return
    supabase.from('issues').select('*, publications(name, slug)').order('issue_number', { ascending: false })
      .then(({ data }) => { if (data) setIssues(data as (Issue & { views?: number })[]) })
  }, [isAuth])

  const handleLogout = () => { sessionStorage.removeItem('adminAuth'); setIsAuth(false) }

  const loadStats = async () => {
    if (!selectedIssue) return
    const { data: viewsData } = await supabase.from('issue_views').select('id', { count: 'exact' }).eq('issue_id', selectedIssue)
    const { data: pagesData } = await supabase.from('page_views').select('page_number').eq('issue_id', selectedIssue).order('page_number')
    const pageCounts: Record<number, number> = {}
    pagesData?.forEach((p) => { pageCounts[p.page_number] = (pageCounts[p.page_number] || 0) + 1 })
    const topPages = Object.entries(pageCounts).map(([page, count]) => ({ page_number: Number(page), count })).sort((a, b) => b.count - a.count).slice(0, 10)
    setStats({ totalViews: viewsData?.length || 0, topPages })
  }

  const togglePublish = async (issue: Issue) => {
    const newVal = !issue.is_published
    // Use server API with service-role key — anon key is blocked by RLS
    const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
    const res = await fetch('/api/admin/toggle-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: pw },
      body: JSON.stringify({ issueId: issue.id, isPublished: newVal }),
    })
    if (res.ok) {
      setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, is_published: newVal } : i)))
    } else {
      const data = await res.json()
      alert('Error al cambiar estado: ' + (data.error || 'desconocido'))
    }
  }

  // ── Update cover for an existing issue ────────────────────────────
  const handleCoverUpdate = async (issue: Issue, file: File) => {
    setCoverUpdating(prev => ({ ...prev, [issue.id]: true }))
    try {
      const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
      // 1. Upload file to Storage via API (service-role key needed for storage)
      const form = new FormData()
      form.append('issueId', issue.id)
      form.append('file', file)
      const res = await fetch('/api/admin/update-issue-cover', {
        method: 'POST',
        headers: { Authorization: pw },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error subiendo archivo')
      // DB update is now done server-side in the API (service-role key bypasses RLS)
      // 3. Reload issues list so table reflects new cover
      setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, cover_url: data.coverUrl } : i))
      setCoverDone(prev => ({ ...prev, [issue.id]: true }))
      setTimeout(() => setCoverDone(prev => ({ ...prev, [issue.id]: false })), 3000)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error inesperado')
    }
    setCoverUpdating(prev => ({ ...prev, [issue.id]: false }))
  }


  // ── Edit issue ─────────────────────────────────────────────────────
  const openEdit = (issue: Issue & { views?: number }) => {
    setEditIssue(issue)
    setEditTitle(issue.title || '')
    setEditNumber(String(issue.issue_number))
    setEditPublished(issue.is_published)
  }

  const saveEdit = async () => {
    if (!editIssue) return
    setEditSaving(true)
    try {
      const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
      const res = await fetch('/api/admin/update-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pw },
        body: JSON.stringify({ issueId: editIssue.id, title: editTitle, issueNumber: parseInt(editNumber), isPublished: editPublished }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setIssues(prev => prev.map(i => i.id === editIssue.id ? { ...i, title: editTitle, issue_number: parseInt(editNumber), is_published: editPublished } : i))
      setEditIssue(null)
    } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
    setEditSaving(false)
  }

  // ── Delete issue ────────────────────────────────────────────────────
  const deleteIssue = async (issue: Issue) => {
    if (!confirm(`Eliminar ${issue.title || '#' + issue.issue_number}? Esta accion no se puede deshacer.`)) return
    setDeleting(prev => ({ ...prev, [issue.id]: true }))
    try {
      const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
      const res = await fetch('/api/admin/delete-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: pw },
        body: JSON.stringify({ issueId: issue.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setIssues(prev => prev.filter(i => i.id !== issue.id))
    } catch (e) { alert(e instanceof Error ? e.message : 'Error') }
    setDeleting(prev => ({ ...prev, [issue.id]: false }))
  }

  // ── Server-side pre-render issue pages ────────────────────────────
  // The API renders up to 15 pages per call. We loop until done: true.
  const renderIssue = async (issue: Issue) => {
    setRendering(prev => ({ ...prev, [issue.id]: true }))
    setRenderResult(prev => ({ ...prev, [issue.id]: { ok: false, msg: '' } }))
    try {
      const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
      let startPage   = 1
      let totalPages  = 0
      let pagesRendered = 0

      while (true) {
        setRenderResult(prev => ({
          ...prev,
          [issue.id]: { ok: false, msg: totalPages
            ? `Renderizando… ${pagesRendered}/${totalPages} págs`
            : 'Renderizando…' },
        }))

        const res  = await fetch('/api/render-issue', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: pw },
          body:    JSON.stringify({ issueId: issue.id, startPage }),
        })
        const data = await res.json()

        if (!res.ok) {
          const msg = data.error || 'Error desconocido'
          if (msg.includes('ALTER TABLE')) setShowMigrationSQL(true)
          setRenderResult(prev => ({ ...prev, [issue.id]: { ok: false, msg } }))
          break
        }

        totalPages    = data.totalPdfPages ?? totalPages
        pagesRendered += data.pagesRendered ?? 0

        if (data.done) {
          setRenderResult(prev => ({
            ...prev,
            [issue.id]: { ok: true, msg: `✓ ${pagesRendered} páginas renderizadas` },
          }))
          setIssues(prev => prev.map(i =>
            i.id === issue.id
              ? { ...i, page_images_json: { isSpreadPDF: data.isSpreadPDF, isAllSpread: data.isAllSpread, pageDimensions: { w: 595, h: 842 }, totalPdfPages: data.totalPdfPages, slots: {} } }
              : i
          ))
          setTimeout(() => setRenderResult(prev => ({ ...prev, [issue.id]: { ok: false, msg: '' } })), 8000)
          break
        }

        startPage = data.nextStartPage
      }
    } catch (e) {
      setRenderResult(prev => ({ ...prev, [issue.id]: { ok: false, msg: e instanceof Error ? e.message : 'Error' } }))
    }
    setRendering(prev => ({ ...prev, [issue.id]: false }))
  }

  // ── Sync publication descriptions ─────────────────────────────────
  const syncDescriptions = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
      const res = await fetch('/api/admin/seed-publications', { method: 'POST', headers: { Authorization: pw } })
      if (res.ok) { setSyncMsg('Descripciones actualizadas correctamente.') }
      else        { setSyncMsg('Error al sincronizar.') }
    } catch { setSyncMsg('Error al sincronizar.') }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 4000)
  }

  if (!isAuth) return <AdminLogin onLogin={() => setIsAuth(true)} />

  const sidebarPubs = publications.length > 0
    ? publications.map((p: any) => ({ slug: p.slug, name: p.name, shortName: p.short_name || p.shortName || p.name?.slice(0, 2), issueCount: issues.filter(i => i.publication_id === p.id).length }))
    : PUBLICATIONS_SIDEBAR

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-[#E5E5E5] flex flex-col fixed h-full z-10">
        <div className="p-6 border-b border-[#E5E5E5]">
          <span className="font-display font-bold text-[#080808] text-lg tracking-tight">DEWORK</span>
          <p className="text-[#888] text-xs mt-0.5">Administración</p>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="text-[#AAA] text-[10px] tracking-widest uppercase mb-3 px-3">Publicaciones</p>
          {sidebarPubs.map((pub) => (
            <button key={pub.slug} onClick={() => setActiveTab('issues')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#444] hover:bg-[#F5F5F5] hover:text-[#080808] text-sm mb-1 transition-colors group w-full text-left">
              <span className="w-7 h-7 bg-[#F0F0F0] rounded text-[10px] font-bold text-[#666] flex items-center justify-center flex-shrink-0 group-hover:bg-[#080808] group-hover:text-white transition-colors">
                {(pub.shortName || 'DW').slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 truncate text-sm">{pub.name}</span>
              <span className="text-[#CCC] text-xs flex-shrink-0">{pub.issueCount || ''}</span>
            </button>
          ))}
          <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
            <p className="text-[#AAA] text-[10px] tracking-widest uppercase mb-3 px-3">Herramientas</p>
            <button onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors w-full text-left ${activeTab === 'upload' ? 'bg-[#080808] text-white' : 'text-[#444] hover:bg-[#F5F5F5]'}`}>
              <span className="w-7 h-7 bg-[#F0F0F0] rounded flex items-center justify-center text-base leading-none flex-shrink-0">↑</span>
              Subir edición
            </button>
            <button onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors w-full text-left ${activeTab === 'stats' ? 'bg-[#080808] text-white' : 'text-[#444] hover:bg-[#F5F5F5]'}`}>
              <span className="w-7 h-7 bg-[#F0F0F0] rounded flex items-center justify-center text-xs flex-shrink-0">▦</span>
              Estadísticas
            </button>
            <button onClick={() => setActiveTab('issues')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors w-full text-left ${activeTab === 'issues' ? 'bg-[#080808] text-white' : 'text-[#444] hover:bg-[#F5F5F5]'}`}>
              <span className="w-7 h-7 bg-[#F0F0F0] rounded flex items-center justify-center text-xs flex-shrink-0">☰</span>
              Ediciones
            </button>
            <a href="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#444] hover:bg-[#F5F5F5] text-sm transition-colors">
              <span className="w-7 h-7 bg-[#F0F0F0] rounded flex items-center justify-center text-xs flex-shrink-0">↗</span>
              Ver sitio
            </a>
          </div>
        </nav>
        <div className="p-4 border-t border-[#E5E5E5]">
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-[#888] text-sm hover:text-[#080808] rounded-lg hover:bg-[#F5F5F5] transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto min-h-screen">

        {/* Upload */}
        {activeTab === 'upload' && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#080808]">Subir nueva edición</h1>
              <p className="text-[#888] text-sm mt-1">Completá los datos y subí el PDF de la edición.</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 max-w-2xl">
              {pubsLoading ? <p className="text-[#888] text-sm">Cargando publicaciones…</p> : <UploadForm publications={publications} />}
            </div>
          </div>
        )}

        {/* Stats */}
        {activeTab === 'stats' && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#080808]">Estadísticas</h1>
              <p className="text-[#888] text-sm mt-1">Lecturas y páginas más vistas por edición.</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-6">
                <p className="text-[#888] text-xs uppercase tracking-wider mb-2">Total ediciones</p>
                <p className="text-3xl font-bold text-[#080808]">{issues.length || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-6">
                <p className="text-[#888] text-xs uppercase tracking-wider mb-2">Publicaciones activas</p>
                <p className="text-3xl font-bold text-[#080808]">{publications.length || 5}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-6">
                <p className="text-[#888] text-xs uppercase tracking-wider mb-2">Lectores mensuales</p>
                <p className="text-3xl font-bold text-[#080808]">10.000+</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-8">
              <h2 className="font-semibold text-[#080808] mb-6">Estadísticas de lectura</h2>
              <div className="flex flex-col sm:flex-row gap-4 mb-6 max-w-lg">
                <select value={selectedPub} onChange={(e) => { setSelectedPub(e.target.value); setSelectedIssue('') }}
                  className="flex-1 border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-[#080808] text-sm focus:outline-none focus:border-[#080808] bg-white">
                  <option value="">Seleccioná publicación</option>
                  {publications.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={selectedIssue} onChange={(e) => setSelectedIssue(e.target.value)}
                  className="flex-1 border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-[#080808] text-sm focus:outline-none focus:border-[#080808] bg-white" disabled={!selectedPub}>
                  <option value="">Seleccioná edición</option>
                  {issues.filter((i) => i.publication_id === selectedPub).map((i) => (
                    <option key={i.id} value={i.id}>#{i.issue_number} — {i.title}</option>
                  ))}
                </select>
                <button onClick={loadStats} disabled={!selectedIssue}
                  className="bg-[#080808] text-white px-6 py-2.5 rounded-lg text-sm hover:bg-[#333] transition-colors disabled:opacity-50">
                  Ver stats
                </button>
              </div>
              {stats && (
                <div className="space-y-4">
                  <div className="border border-[#E5E5E5] rounded-lg p-6">
                    <p className="text-[#888] text-sm mb-1">Total lectores únicos</p>
                    <p className="text-5xl font-bold text-[#080808]">{stats.totalViews}</p>
                  </div>
                  {stats.topPages.length > 0 && (
                    <div className="border border-[#E5E5E5] rounded-lg p-6">
                      <h3 className="font-semibold text-[#080808] mb-4">Páginas más vistas</h3>
                      <div className="space-y-3">
                        {stats.topPages.map((p) => {
                          const pct = Math.round((p.count / stats.topPages[0].count) * 100)
                          return (
                            <div key={p.page_number} className="flex items-center gap-3">
                              <span className="text-[#888] text-xs w-16 text-right flex-shrink-0">Pág. {p.page_number}</span>
                              <div className="flex-1 h-5 bg-[#F5F5F5] rounded overflow-hidden">
                                <div className="h-full bg-[#080808]/25 rounded transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[#444] text-xs w-8">{p.count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Issues */}
        {activeTab === 'issues' && (
          <div>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-[#080808]">Ediciones</h1>
                <p className="text-[#888] text-sm mt-1">Gestión de publicaciones y ediciones.</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Sync descriptions button */}
                <div className="relative">
                  <button onClick={syncDescriptions} disabled={syncing}
                    title="Actualiza nombres y descripciones de publicaciones en la DB"
                    className="text-[#444] border border-[#E5E5E5] bg-white text-xs px-4 py-2.5 rounded-lg hover:border-[#080808] transition-colors disabled:opacity-50 flex items-center gap-2">
                    {syncing && <span className="w-3 h-3 border border-[#AAA] border-t-transparent rounded-full animate-spin" />}
                    {syncing ? 'Sincronizando...' : 'Sync descripciones'}
                  </button>
                  {syncMsg && (
                    <div className={`absolute top-full right-0 mt-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg z-20 ${syncMsg.includes('Error') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                      {syncMsg.includes('Error') ? '✗ ' : '✓ '}{syncMsg}
                    </div>
                  )}
                </div>
                <button onClick={() => setActiveTab('upload')}
                  className="bg-[#080808] text-white text-xs px-5 py-2.5 rounded-lg hover:bg-[#333] transition-colors">
                  + Subir nueva edición
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E5E5]">
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Publicación</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">#</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Título</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Estado</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Páginas</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[#888] text-sm">
                        No hay ediciones todavía. Subí la primera desde "Subir edición".
                      </td>
                    </tr>
                  ) : issues.map((issue, i) => (
                    <tr key={issue.id}
                      className={`border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors ${i === issues.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-6 py-4 text-[#888] truncate max-w-[140px]">
                        {(publications.find(p => p.id === issue.publication_id))?.name || '—'}
                      </td>
                      <td className="px-6 py-4 text-[#080808] font-medium">#{issue.issue_number}</td>
                      <td className="px-6 py-4 text-[#444] truncate max-w-[200px]">{issue.title}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${issue.is_published ? 'bg-green-100 text-green-700' : 'bg-[#F0F0F0] text-[#888]'}`}>
                          {issue.is_published ? 'Publicada' : 'Borrador'}
                        </span>
                      </td>

                      {/* ── Render cell ── */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => renderIssue(issue)}
                            disabled={rendering[issue.id]}
                            title={issue.page_images_json ? 'Re-renderizar páginas' : 'Renderizar páginas (pre-rendering)'}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                              issue.page_images_json
                                ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
                                : 'border-[#E5E5E5] text-[#555] hover:border-[#080808]'
                            }`}
                          >
                            {rendering[issue.id]
                              ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />Procesando…</>
                              : issue.page_images_json
                                ? <>↺ Re-render</>
                                : <>⚡ Renderizar</>
                            }
                          </button>
                          {renderResult[issue.id]?.msg && (
                            <span className={`text-xs max-w-[180px] truncate ${renderResult[issue.id].ok ? 'text-green-600' : 'text-red-500'}`}
                              title={renderResult[issue.id].msg}>
                              {renderResult[issue.id].msg}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <a href={`/revistas/${(publications.find(p => p.id === issue.publication_id))?.slug || ''}/${issue.issue_number}`}
                            target="_blank" rel="noreferrer"
                            className="text-[#AAA] hover:text-[#080808] transition-colors" title="Ver">
                            <Eye size={15} />
                          </a>
                          <button onClick={() => togglePublish(issue)}
                            className="text-[#AAA] hover:text-[#080808] transition-colors"
                            title={issue.is_published ? 'Despublicar' : 'Publicar'}>
                            {issue.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          {/* Update cover button */}
                          <button
                            onClick={() => coverInputRefs.current[issue.id]?.click()}
                            disabled={coverUpdating[issue.id]}
                            className="text-[#AAA] hover:text-[#080808] transition-colors disabled:opacity-40"
                            title="Cambiar portada">
                            {coverDone[issue.id]
                              ? <Check size={15} className="text-green-500" />
                              : coverUpdating[issue.id]
                                ? <span className="w-3.5 h-3.5 border border-[#AAA] border-t-transparent rounded-full animate-spin inline-block" />
                                : <Camera size={15} />
                            }
                          </button>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            ref={el => { coverInputRefs.current[issue.id] = el }}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleCoverUpdate(issue, file)
                              e.target.value = ''
                            }}
                          />
                          {/* Edit button */}
                          <button
                            onClick={() => openEdit(issue)}
                            className="text-[#AAA] hover:text-[#080808] transition-colors"
                            title="Editar">
                            <Pencil size={14} />
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={() => deleteIssue(issue)}
                            disabled={deleting[issue.id]}
                            className="text-[#AAA] hover:text-red-500 transition-colors disabled:opacity-40"
                            title="Eliminar">
                            {deleting[issue.id]
                              ? <span className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin inline-block" />
                              : <Trash2 size={14} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


      {/* ── Migration SQL helper modal ── */}
      {showMigrationSQL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#080808]">Configuración requerida (una vez)</h3>
              <button onClick={() => setShowMigrationSQL(false)} className="text-[#AAA] hover:text-[#080808] text-lg leading-none">✕</button>
            </div>
            <p className="text-sm text-[#555]">
              Ejecutá este SQL en el <strong>SQL Editor</strong> de tu proyecto Supabase para agregar la columna de imágenes pre-renderizadas:
            </p>
            <pre className="bg-[#F5F5F5] rounded-lg p-4 text-xs font-mono text-[#333] select-all overflow-x-auto">
              {`ALTER TABLE issues\n  ADD COLUMN IF NOT EXISTS page_images_json jsonb;`}
            </pre>
            <p className="text-xs text-[#888]">
              También creá un bucket público llamado <strong>page-images</strong> en Storage → New bucket.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText('ALTER TABLE issues\n  ADD COLUMN IF NOT EXISTS page_images_json jsonb;')
                }}
                className="flex-1 bg-[#080808] text-white py-2 rounded-lg text-sm hover:bg-[#333] transition-colors"
              >
                Copiar SQL
              </button>
              <button onClick={() => setShowMigrationSQL(false)}
                className="px-4 border border-[#E5E5E5] rounded-lg text-sm text-[#444] hover:bg-[#F5F5F5]">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#080808]">Editar edicion</h3>
              <button onClick={() => setEditIssue(null)} className="text-[#AAA] hover:text-[#080808]">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#333] mb-1.5">Titulo</label>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#080808]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#333] mb-1.5">Numero de edicion</label>
              <input
                type="number"
                value={editNumber}
                onChange={e => setEditNumber(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#080808]"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={e => setEditPublished(e.target.checked)}
                className="w-4 h-4 accent-[#080808]"
              />
              <span className="text-sm text-[#444]">Publicada</span>
            </label>
            <div className="flex gap-3 pt-1">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 bg-[#080808] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50">
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                onClick={() => setEditIssue(null)}
                className="px-5 border border-[#E5E5E5] rounded-lg text-sm text-[#444] hover:bg-[#F5F5F5] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  )
}
