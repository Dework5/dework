'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, BarChart2, Calendar, Users, Send } from 'lucide-react'

const stats = [
  { value: '+139', label: 'Ediciones de San Diego La Revista', highlight: true },
  { value: '+10.000', label: 'Lectores mensuales únicos', highlight: true },
  { value: '5 años', label: 'Publicando en zona norte', highlight: true },
]

const reasons = [
  {
    icon: <MapPin size={20} />,
    title: 'Audiencia local',
    desc: 'Lectores reales de zona norte. No bots, no tráfico frío.',
  },
  {
    icon: <BarChart2 size={20} />,
    title: 'Métricas transparentes',
    desc: 'Accedé a estadísticas reales de lectura: vistas por edición y páginas más leídas.',
  },
  {
    icon: <Calendar size={20} />,
    title: 'Presencia constante',
    desc: 'Una edición mensual. Tu marca visible todos los meses.',
  },
  {
    icon: <Users size={20} />,
    title: 'Acompañamiento editorial',
    desc: 'Diseñamos tu anuncio para que se integre naturalmente con el contenido.',
  },
]

const formats = [
  {
    name: 'Página completa',
    desc: 'Máxima visibilidad. Una página entera para tu marca.',
    badge: 'RECOMENDADO',
  },
  {
    name: 'Media página',
    desc: 'Alta presencia. Mitad de página horizontal o vertical.',
    badge: null,
  },
  {
    name: 'Contraportada',
    desc: 'El lugar más visto de cualquier revista. Precio especial.',
    badge: null,
  },
  {
    name: 'Doble página',
    desc: 'Impacto máximo con una apertura completa.',
    badge: null,
  },
  {
    name: 'Banner interior',
    desc: 'Presencia discreta en secciones específicas.',
    badge: null,
  },
  {
    name: 'Aviso clasificado',
    desc: 'Para pequeños comercios y servicios locales.',
    badge: null,
  },
]

const publications = [
  'San Diego La Revista',
  'Haras del Pilar',
  'Pilará Magazine',
  'Los Lagartos',
  'Campo Chico',
  'Todas',
]

export default function AnunciantesPage() {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    empresa: '',
    publicacion: '',
    mensaje: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('https://formspree.io/f/xpwrprlw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, _subject: 'Nueva consulta de anunciante — Dework' }),
      })
      if (res.ok) {
        setStatus('sent')
        setForm({ nombre: '', email: '', telefono: '', empresa: '', publicacion: '', mensaje: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  const inputClass =
    'w-full bg-surface border border-border rounded-sm px-4 py-3 text-text-primary font-body text-sm focus:outline-none focus:border-text-secondary transition-colors placeholder:text-text-muted'

  return (
    <>
      <h1 className="sr-only">Llegá a tu audiencia con Dework</h1>

      {/* Hero */}
      <section className="bg-surface pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="max-w-content mx-auto px-4 md:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <motion.div
              className="flex-1 space-y-6 text-center lg:text-left"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-display font-bold text-text-primary leading-tight">
                Llegá a tu audiencia con Dework
              </h2>
              <p className="text-text-secondary font-body text-lg leading-relaxed max-w-xl">
                Nuestras revistas llegan mes a mes a miles de lectores de San Diego, Pilará
                y zona norte de Buenos Aires. Tu marca, donde importa.
              </p>
              <a
                href="#contacto-anunciantes"
                className="inline-flex items-center gap-2 bg-primary text-white py-3 px-8 rounded-sm font-body font-medium tracking-wide hover:bg-primary-dark hover:scale-[1.02] transition-all duration-200 min-h-[48px]"
              >
                Quiero pautar
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-background py-16 md:py-24">
        <div className="max-w-content mx-auto px-4 md:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-text-primary">
              Nuestros números
            </h2>
            <p className="mt-3 text-text-secondary font-body">
              Datos reales de nuestras publicaciones.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-surface-elevated border border-border rounded-sm p-8 text-center"
              >
                <div className="text-5xl font-display font-bold text-primary mb-2">
                  {stat.value}
                </div>
                <div className="text-text-secondary font-body text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Por qué Dework */}
      <section className="bg-surface py-16 md:py-24">
        <div className="max-w-content mx-auto px-4 md:px-8">
          <motion.h2
            className="text-3xl md:text-4xl font-display font-bold text-text-primary text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            ¿Por qué elegir Dework?
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reasons.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-surface-elevated border border-border rounded-sm p-8 flex gap-4"
              >
                <div className="text-primary mt-0.5 flex-shrink-0">{r.icon}</div>
                <div>
                  <h3 className="font-display font-semibold text-text-primary text-lg mb-2">
                    {r.title}
                  </h3>
                  <p className="text-text-secondary font-body text-sm leading-relaxed">
                    {r.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Formatos */}
      <section className="bg-background py-16 md:py-24">
        <div className="max-w-content mx-auto px-4 md:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-text-primary">
              Formatos disponibles
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formats.map((f, i) => (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-surface border border-border rounded-sm p-6 space-y-2 relative"
              >
                {f.badge && (
                  <span className="absolute top-3 right-3 text-[10px] bg-primary text-white px-2 py-0.5 rounded-sm font-body tracking-wider">
                    {f.badge}
                  </span>
                )}
                <h3 className="font-display font-semibold text-text-primary">{f.name}</h3>
                <p className="text-text-secondary font-body text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a
              href="#contacto-anunciantes"
              className="inline-flex items-center gap-2 border border-border text-text-primary py-3 px-8 rounded-sm font-body font-medium hover:border-text-secondary transition-colors min-h-[48px]"
            >
              Consultá disponibilidad y precios
            </a>
          </div>
        </div>
      </section>

      {/* Formulario anunciantes */}
      <section id="contacto-anunciantes" className="bg-surface py-16 md:py-24">
        <div className="max-w-content mx-auto px-4 md:px-8">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-text-primary">
              Comenzá a pautar
            </h2>
            <p className="mt-3 text-text-secondary font-body">
              Completá el formulario y te contactamos en menos de 24 horas.
            </p>
          </motion.div>

          <div className="max-w-lg mx-auto">
            {status === 'sent' ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Send size={24} className="text-primary" />
                </div>
                <h3 className="font-display font-semibold text-text-primary text-xl">
                  ¡Consulta enviada!
                </h3>
                <p className="text-text-secondary font-body">
                  Te contactamos en menos de 24 horas.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Nombre y apellido"
                    required
                    className={inputClass}
                  />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Email"
                    required
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="tel"
                    name="telefono"
                    value={form.telefono}
                    onChange={handleChange}
                    placeholder="Teléfono / WhatsApp"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    name="empresa"
                    value={form.empresa}
                    onChange={handleChange}
                    placeholder="Empresa o negocio"
                    className={inputClass}
                  />
                </div>
                <select
                  name="publicacion"
                  value={form.publicacion}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Publicación de interés</option>
                  {publications.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <textarea
                  name="mensaje"
                  value={form.mensaje}
                  onChange={handleChange}
                  placeholder="Mensaje adicional (opcional)"
                  rows={4}
                  className={`${inputClass} resize-none`}
                />

                {status === 'error' && (
                  <p className="text-primary text-sm font-body">
                    Error al enviar. Intentá de nuevo o escribinos a Info@dework.com.ar
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="flex items-center gap-2 bg-primary text-white py-3 px-8 rounded-sm font-body font-medium tracking-wide hover:bg-primary-dark hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                >
                  <Send size={16} />
                  {status === 'sending' ? 'Enviando...' : 'Enviar consulta'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
