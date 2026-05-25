'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface AdminLoginProps {
  onLogin: () => void
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Pequeño delay para UX
    await new Promise((r) => setTimeout(r, 300))

    const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || ''
    if (password === adminPass) {
      sessionStorage.setItem('adminAuth', 'true')
      onLogin()
    } else {
      setError('Contraseña incorrecta. Intentá de nuevo.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-primary text-2xl font-bold">•</span>
            <span className="font-display font-bold text-2xl text-text-primary tracking-wider">
              DEWORK
            </span>
          </div>
          <h1 className="font-body text-text-secondary text-sm tracking-widest uppercase">
            Panel de Administración
          </h1>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-sm p-8 space-y-6"
        >
          <div className="space-y-2">
            <label className="block text-xs font-body text-text-secondary uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-elevated border border-border rounded-sm px-4 py-3 text-text-primary font-body text-sm focus:outline-none focus:border-text-secondary transition-colors pr-12"
                placeholder="••••••••"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-primary text-sm font-body">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-primary text-white py-3 rounded-sm font-body font-medium tracking-wide hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
          >
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
