'use client'

import { motion } from 'framer-motion'

export function ContactSection() {
  return (
    <section id="contacto" className="bg-dw-black border-t border-dw-border py-14 md:py-28 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="mb-8 md:mb-16">
          <div className="flex items-baseline gap-4 mb-3">
            <span className="text-dw-muted text-[10px] tracking-[0.3em] uppercase">03 /</span>
            <h2 className="font-display text-4xl md:text-5xl text-dw-white font-bold">Contacto</h2>
          </div>
          <p className="text-dw-muted text-sm max-w-md leading-relaxed">
            ¿Querés anunciarte, colaborar o saber más sobre nuestras publicaciones? Escribinos.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-16">

          {/* Form */}
          <motion.form
            action="https://formspree.io/f/xwpkdqbn" method="POST"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-col gap-3">
            <input name="nombre" type="text" placeholder="Nombre" required
              className="bg-dw-surface border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-sub transition-colors" />
            <input name="email" type="email" placeholder="Email" required
              className="bg-dw-surface border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-sub transition-colors" />
            <textarea name="mensaje" placeholder="Mensaje" rows={5} required
              className="bg-dw-surface border border-dw-border text-dw-text placeholder-dw-muted text-sm px-5 py-4 focus:outline-none focus:border-dw-sub transition-colors resize-none" />
            <button type="submit"
              className="bg-dw-white text-dw-black text-[11px] font-semibold tracking-[0.12em] uppercase py-4 hover:bg-dw-text transition-colors duration-200 mt-2">
              Enviar mensaje →
            </button>
          </motion.form>

          {/* Contact info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col justify-between">
            <div className="space-y-5 md:space-y-8">
              <div>
                <p className="text-dw-muted text-[10px] tracking-[0.25em] uppercase mb-2">Teléfono</p>
                <p className="text-dw-text text-base">011 3361-6566</p>
              </div>
              <div>
                <p className="text-dw-muted text-[10px] tracking-[0.25em] uppercase mb-2">Email</p>
                <p className="text-dw-text text-base">Info@dework.com.ar</p>
              </div>
              <div>
                <p className="text-dw-muted text-[10px] tracking-[0.25em] uppercase mb-2">Ubicación</p>
                <p className="text-dw-text text-base">Pilar, Buenos Aires, Argentina</p>
              </div>
            </div>

            <div className="flex gap-8 border-t border-dw-border pt-6 mt-8 md:pt-8 md:mt-10">
              <a href="https://www.instagram.com/dework.arg/" target="_blank" rel="noopener noreferrer"
                className="text-dw-muted text-sm hover:text-dw-white transition-colors">
                Instagram
              </a>
              <a href="https://www.facebook.com/dework.arg" target="_blank" rel="noopener noreferrer"
                className="text-dw-muted text-sm hover:text-dw-white transition-colors">
                Facebook
              </a>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
