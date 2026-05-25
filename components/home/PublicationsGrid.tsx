'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { PublicationWithLatestIssue } from '@/lib/types'

interface PublicationsGridProps {
  publications: PublicationWithLatestIssue[]
}

export function PublicationsGrid({ publications }: PublicationsGridProps) {
  return (
    <section className="bg-surface py-16 md:py-24">
      <div className="max-w-content mx-auto px-4 md:px-8">
        <motion.div
          className="mb-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-text-primary">
            Nuestras Publicaciones
          </h2>
          <p className="mt-3 text-text-secondary font-body text-lg">
            Cada revista, una comunidad.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publications.map((pub, index) => (
            <motion.div
              key={pub.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={index === 0 ? 'md:col-span-2 lg:col-span-1' : ''}
            >
              <Link href={`/revistas/${pub.slug}`} className="group block">
                <div
                  className="bg-surface-elevated border border-border rounded-sm overflow-hidden transition-all duration-200 hover:border-opacity-100 hover:-translate-y-[3px] hover:shadow-xl"
                  style={{
                    '--hover-color': pub.accent_color,
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.borderColor =
                      pub.accent_color
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.borderColor = '#2A2A2A'
                  }}
                >
                  {/* Portada */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden">
                    {pub.latest_issue?.cover_url ? (
                      <Image
                        src={pub.latest_issue.cover_url}
                        alt={`Portada ${pub.name}`}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: pub.accent_color + '20' }}
                      >
                        <span className="font-display font-bold text-4xl opacity-30 text-text-primary">
                          {pub.short_name}
                        </span>
                      </div>
                    )}
                    {/* Badge */}
                    <div
                      className="absolute top-3 left-3 px-2 py-1 rounded-sm text-xs font-body font-medium tracking-widest uppercase text-white"
                      style={{ backgroundColor: pub.accent_color }}
                    >
                      {pub.short_name}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="font-display font-semibold text-text-primary text-lg leading-tight mb-3">
                      {pub.name}
                    </h3>
                    <span
                      className="inline-flex items-center gap-1 text-sm font-body transition-colors duration-200"
                      style={{ color: pub.accent_color }}
                    >
                      Ver todas las ediciones
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
