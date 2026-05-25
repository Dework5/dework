'use client'

import { useState } from 'react'
import { Mail, Phone, MapPin, Send } from 'lucide-react'

export function ContactSection() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')

    try {
      const res = await fetch('https://formspree.io/f/xpwrprlw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })

      if (res.ok) {
        setStatus('sent')
        setName('')
        setEmail('')
        setMessage('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="contacto" className="bg-background py-16 md:py-24">
      <div className="max-w-content mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-text-primary">
            Escribinos
          </h2>
          <p className="mt-3 text-text-secondary font-body text-lg">
            Para pautar, consultar o sumarte a nuestro equipo.
          </p>
        </div>

        <div className="max-w-lg mx-auto space-y-8">
          {/* Formulario */}
          {status === 'sent' ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Send size={24} className="text-primary" />
              </div>
              <h3 className="font-display font-semibold text-text-primary text-xl">
                ¡Mensaje enviado!
              </h3>
              <p className="text-text-secondary font-body">
                Te respondemos a la brevedad.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="text-primary text-sm font-body hover:underline"
              >
                Enviar otro mensaje
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre"
                required
                className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary font-body text-sm focus:outline-none focus:border-text-secondary transition-colors placeholder:text-text-muted"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary font-body text-sm focus:outline-none focus:border-text-secondary transition-colors placeholder:text-text-muted"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mensaje"
                rows={4}
                required
                className="w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary font-body text-sm focus:outline-none focus:border-text-secondary transition-colors placeholder:text-text-muted resize-none"
              />

              {status === 'error' && (
                <p className="text-primary text-sm font-body">
                  Error al enviar. Intentá de nuevo.
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="flex items-center gap-2 bg-primary text-white py-3 px-8 rounded-sm font-body font-medium tracking-wide hover:bg-primary-dark hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
              >
                <Send size={16} />
                {status === 'sending' ? 'Enviando...' : 'Enviar mensaje'}
              </button>
            </form>
          )}

          {/* Datos de contacto */}
          <div className="border-t border-border pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href="tel:+5401133616566"
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-body"
            >
              <Phone size={14} className="text-primary flex-shrink-0" />
              011 3361-6566
            </a>
            <a
              href="mailto:Info@dework.com.ar"
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-body"
            >
              <Mail size={14} className="text-primary flex-shrink-0" />
              Info@dework.com.ar
            </a>
            <div className="flex items-center gap-2 text-text-secondary text-sm font-body">
              <MapPin size={14} className="text-primary flex-shrink-0" />
              Pilar, Buenos Aires
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
