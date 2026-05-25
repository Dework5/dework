'use client'

import { motion } from 'framer-motion'

export function ContactSection() {
  return (
    <section id="contacto" className="bg-dw-surface border-t border-dw-border py-28 px-6 md:px-10">
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <p className="text-dw-muted text-[10px] tracking-[0.3em] uppercase mb-4">04 / Contacto</p>
          <h2 className="font-display text-4xl text-dw-white font-bold mb-10">Escribinos</h2>
        </motion.div>
        <motion.form action="https://formspree.io/f/xwpkdqbn" method="POST"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col gap-3">
          <input name="nombre" type="text" placeholder="Nombre" required
            className="bg-dw-card border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-hover transition-colors" />
          <input name="email" type="email" placeholder="Email" required
            className="bg-dw-card border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-hover transition-colors" />
          <textarea name="mensaje" placeholder="Mensaje" rows={4} required
            className="bg-dw-card border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-hover transition-colors resize-none" />
          <button type="submit"
            className="bg-dw-white text-dw-black text-[11px] font-semibold tracking-[0.12em] uppercase py-4 hover:bg-dw-text transition-colors duration-200 mt-2">
            Enviar mensaje →
          </button>
        </motion.form>
        <div className="mt-10 flex flex-col gap-2">
          <p className="text-dw-muted text-sm">011 3361-6566</p>
          <p className="text-dw-muted text-sm">Info@dework.com.ar</p>
          <p className="text-dw-muted text-sm">Pilar, Buenos Aires</p>
        </div>
      </div>
    </section>
  )
}
