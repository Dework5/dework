'use client'

import { useState } from 'react'

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
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E5E5] p-10 w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-display font-bold text-[#080808] text-2xl tracking-tight">DEWORK</span>
          <p className="text-[#888] text-sm mt-1">Panel de Administración</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#333] text-xs font-medium tracking-wider uppercase mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-4 py-3 text-[#080808] text-sm focus:outline-none focus:border-[#080808] transition-colors pr-16"
                placeholder="••••••••"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAA] hover:text-[#333] text-xs transition-colors"
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-[#080808] text-white rounded-lg py-3 text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
