'use client'

import { useState, useEffect } from 'react'
import { AdminLogin } from '@/components/admin/AdminLogin'
import { UploadForm } from '@/components/admin/UploadForm'
import { supabase } from '@/lib/supabase'
import { Publication, Issue } from '@/lib/types'
import { LogOut, Upload, BarChart2, BookOpen, Eye, EyeOff } from 'lucide-react'

type Tab = 'upload' | 'stats' | 'issues'

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('upload')
  const [publications, setPublications] = useState<Publication[]>([])
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
    supabase.from('publications').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setPublications(data)
    })
  }, [isAuth])

  useEffect(() => {
    if (!isAuth) return
    supabase
      .from('issues')
      .select('*, publications(name)')
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

    // Agrupar páginas
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Subir edición', icon: <Upload size={16} /> },
    { id: 'stats', label: 'Estadísticas', icon: <BarChart2 size={16} /> },
    { id: 'issues', label: 'Ediciones', icon: <BookOpen size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary font-bold text-lg">•</span>
          <span className="font-display font-bold text-text-primary tracking-wider">DEWORK</span>
          <span className="text-text-muted text-sm font-body ml-2">Panel Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-body transition-colors min-h-[44px] px-3"
        >
          <LogOut size={15} />
          Cerrar sesión
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-4 md:px-8">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-body border-b-2 transition-colors min-h-[52px] ${
                activeTab === tab.id
                  ? 'border-primary text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-content mx-auto px-4 md:px-8 py-8">
        {activeTab === 'upload' && (
          <div>
            <h2 className="text-2xl font-display font-bold text-text-primary mb-6">
              Subir nueva edición
            </h2>
            <UploadForm publications={publications} />
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            <h2 className="text-2xl font-display font-bold text-text-primary mb-6">
              Estadísticas de lectura
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 max-w-lg">
              <select
                value={selectedPub}
                onChange={(e) => { setSelectedPub(e.target.value); setSelectedIssue('') }}
                className="flex-1 bg-surface border border-border rounded-sm px-4 py-2 text-text-primary font-body text-sm focus:outline-none"
              >
                <option value="">Seleccioná publicación</option>
                {publications.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={selectedIssue}
                onChange={(e) => setSelectedIssue(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-sm px-4 py-2 text-text-primary font-body text-sm focus:outline-none"
                disabled={!selectedPub}
              >
                <option value="">Seleccioná edición</option>
                {issues
                  .filter((i) => i.publication_id === selectedPub)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      #{i.issue_number} — {i.title}
                    </option>
                  ))}
              </select>
              <button
                onClick={loadStats}
                disabled={!selectedIssue}
                className="bg-primary text-white px-6 py-2 rounded-sm font-body text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                Ver stats
              </button>
            </div>

            {stats && (
              <div className="space-y-6 max-w-2xl">
                <div className="bg-surface border border-border rounded-sm p-6">
                  <p className="text-text-secondary text-sm font-body mb-1">Total lectores únicos</p>
                  <p className="text-5xl font-display font-bold text-primary">{stats.totalViews}</p>
                </div>

                {stats.topPages.length > 0 && (
                  <div className="bg-surface border border-border rounded-sm p-6">
                    <h3 className="font-display font-semibold text-text-primary mb-4">
                      Páginas más vistas
                    </h3>
                    <div className="space-y-3">
                      {stats.topPages.map((p) => {
                        const maxCount = stats.topPages[0].count
                        const pct = Math.round((p.count / maxCount) * 100)
                        return (
                          <div key={p.page_number} className="flex items-center gap-3">
                            <span className="text-text-muted text-xs font-body w-16 text-right flex-shrink-0">
                              Pág. {p.page_number}
                            </span>
                            <div className="flex-1 h-6 bg-surface-elevated rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-primary/60 rounded-sm transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-text-secondary text-xs font-body w-8">
                              {p.count}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'issues' && (
          <div>
            <h2 className="text-2xl font-display font-bold text-text-primary mb-6">
              Ediciones publicadas
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-text-secondary py-3 px-2 font-normal">Publicación</th>
                    <th className="text-left text-text-secondary py-3 px-2 font-normal">#</th>
                    <th className="text-left text-text-secondary py-3 px-2 font-normal">Título</th>
                    <th className="text-left text-text-secondary py-3 px-2 font-normal">Estado</th>
                    <th className="text-left text-text-secondary py-3 px-2 font-normal">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="py-3 px-2 text-text-secondary truncate max-w-[120px]">
                        {(issue as Issue & { publications?: { name: string } }).publications?.name || '—'}
                      </td>
                      <td className="py-3 px-2 text-text-primary">#{issue.issue_number}</td>
                      <td className="py-3 px-2 text-text-secondary truncate max-w-[200px]">{issue.title}</td>
                      <td className="py-3 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-sm ${issue.is_published ? 'bg-green-900/30 text-green-400' : 'bg-surface-elevated text-text-muted'}`}>
                          {issue.is_published ? 'Publicada' : 'Borrador'}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/revistas/${issue.publication_id}/${issue.issue_number}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-text-muted hover:text-text-primary transition-colors"
                            title="Ver"
                          >
                            <Eye size={15} />
                          </a>
                          <button
                            onClick={() => togglePublish(issue)}
                            className="text-text-muted hover:text-text-primary transition-colors"
                            title={issue.is_published ? 'Despublicar' : 'Publicar'}
                          >
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
      </div>
    </div>
  )
}
