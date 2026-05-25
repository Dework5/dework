'use client'

import { useState, useEffect } from 'react'
import { AdminLogin } from '@/components/admin/AdminLogin'
import { UploadForm } from '@/components/admin/UploadForm'
import { supabase } from '@/lib/supabase'
import { Publication, Issue } from '@/lib/types'
import { Eye, EyeOff } from 'lucide-react'

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

  useEffect(() => {
    const auth = sessionStorage.getItem('adminAuth')
    if (auth === 'true') setIsAuth(true)
  }, [])

  useEffect(() => {
    if (!isAuth) return
    setPubsLoading(true)

    const loadPublications = async () => {
      // Try without is_active filter to get all publications
      const { data } = await supabase
        .from('publications')
        .select('*')
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        setPublications(data)
        setPubsLoading(false)
      } else {
        // Publications table is empty → auto-seed the 5 default publications
        try {
          const pw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
          const res = await fetch('/api/admin/seed-publications', {
            method: 'POST',
            headers: { Authorization: pw },
          })
          if (res.ok) {
            const json = await res.json()
            if (json.publications) setPublications(json.publications)
          }
        } catch {
          // silent — form will show empty
        }
        setPubsLoading(false)
      }
    }

    loadPublications()
  }, [isAuth])

  useEffect(() => {
    if (!isAuth) return
    supabase
      .from('issues')
      .select('*, publications(name, slug)')
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        if (data) setIssues(data as (Issue & { views?: number })[])
      })
  }, [isAuth])

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth')
    setIsAuth(false)
  }

  const loadStats = async () => {
    if (!selectedIssue) return
    const { data: viewsData } = await supabase
      .from('issue_views')
      .select('id', { count: 'exact' })
      .eq('issue_id', selectedIssue)

    const { data: pagesData } = await supabase
      .from('page_views')
      .select('page_number')
      .eq('issue_id', selectedIssue)
      .order('page_number')

    const pageCounts: Record<number, number> = {}
    pagesData?.forEach((p) => {
      pageCounts[p.page_number] = (pageCounts[p.page_number] || 0) + 1
    })
    const topPages = Object.entries(pageCounts)
      .map(([page, count]) => ({ page_number: Number(page), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    setStats({ totalViews: viewsData?.length || 0, topPages })
  }

  const togglePublish = async (issue: Issue) => {
    await supabase
      .from('issues')
      .update({ is_published: !issue.is_published })
      .eq('id', issue.id)
    setIssues((prev) =>
      prev.map((i) => (i.id === issue.id ? { ...i, is_published: !i.is_published } : i))
    )
  }

  if (!isAuth) {
    return <AdminLogin onLogin={() => setIsAuth(true)} />
  }

  const sidebarPubs = publications.length > 0
    ? publications.map((p: any) => ({
        slug: p.slug,
        name: p.name,
        shortName: p.short_name || p.shortName || p.name?.slice(0, 2),
        issueCount: issues.filter(i => i.publication_id === p.id).length,
      }))
    : PUBLICATIONS_SIDEBAR

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex">

      {/* ── SIDEBAR ── */}
      <aside className="w-64 bg-white border-r border-[#E5E5E5] flex flex-col fixed h-full z-10">

        {/* Logo */}
        <div className="p-6 border-b border-[#E5E5E5]">
          <span className="font-display font-bold text-[#080808] text-lg tracking-tight">DEWORK</span>
          <p className="text-[#888] text-xs mt-0.5">Administración</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="text-[#AAA] text-[10px] tracking-widest uppercase mb-3 px-3">Publicaciones</p>
          {sidebarPubs.map((pub) => (
            <button key={pub.slug}
              onClick={() => setActiveTab('issues')}
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

        {/* Logout */}
        <div className="p-4 border-t border-[#E5E5E5]">
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-[#888] text-sm hover:text-[#080808] rounded-lg hover:bg-[#F5F5F5] transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── CONTENT AREA ── */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto min-h-screen">

        {/* Upload */}
        {activeTab === 'upload' && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#080808]">Subir nueva edición</h1>
              <p className="text-[#888] text-sm mt-1">Completá los datos y subí el PDF de la edición.</p>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 max-w-2xl">
              {pubsLoading ? (
                <p className="text-[#888] text-sm">Cargando publicaciones…</p>
              ) : (
                <UploadForm publications={publications} />
              )}
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
                  className="flex-1 border border-[#E5E5E5] rounded-lg px-4 py-2.5 text-[#080808] text-sm focus:outline-none focus:border-[#080808] bg-white"
                  disabled={!selectedPub}>
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
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[#080808]">Ediciones</h1>
                <p className="text-[#888] text-sm mt-1">Gestión de publicaciones y ediciones.</p>
              </div>
              <button onClick={() => setActiveTab('upload')}
                className="bg-[#080808] text-white text-xs px-5 py-2.5 rounded-lg hover:bg-[#333] transition-colors">
                + Subir nueva edición
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E5E5]">
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Publicación</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">#</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Título</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Estado</th>
                    <th className="text-left px-6 py-3 text-xs text-[#888] font-medium uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-[#888] text-sm">
                        No hay ediciones todavía. Subí la primera desde "Subir edición".
                      </td>
                    </tr>
                  ) : issues.map((issue, i) => (
                    <tr key={issue.id}
                      className={`border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors ${i === issues.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-6 py-4 text-[#888] truncate max-w-[140px]">
                        {(issue as Issue & { publications?: { name: string } }).publications?.name || '—'}
                      </td>
                      <td className="px-6 py-4 text-[#080808] font-medium">#{issue.issue_number}</td>
                      <td className="px-6 py-4 text-[#444] truncate max-w-[200px]">{issue.title}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${issue.is_published ? 'bg-green-100 text-green-700' : 'bg-[#F0F0F0] text-[#888]'}`}>
                          {issue.is_published ? 'Publicada' : 'Borrador'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <a href={`/revistas/${(issue as any).publications?.slug || issue.publication_id}/${issue.issue_number}`}
                            target="_blank" rel="noreferrer"
                            className="text-[#AAA] hover:text-[#080808] transition-colors" title="Ver">
                            <Eye size={15} />
                          </a>
                          <button onClick={() => togglePublish(issue)}
                            className="text-[#AAA] hover:text-[#080808] transition-colors"
                            title={issue.is_published ? 'Despublicar' : 'Publicar'}>
                            {issue.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
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

      </main>
    </div>
  )
}
