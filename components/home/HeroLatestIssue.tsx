'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Issue, Publication } from '@/lib/types'

interface HeroLatestIssueProps {
  issue: Issue | null
  publication: Publication | null
}

export function HeroLatestIssue({ issue, publication }: HeroLatestIssueProps) {
  if (!issue || !publication) {
    return (
      <section className="min-h-screen bg-background flex items-center">
        <div className="max-w-content mx-auto px-4 md:px-8 py-24">
          <p className="text-text-muted font-body">Cargando última edición…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-screen bg-background flex items-center pt-16">
      <div className="max-w-content mx-auto px-4 md:px-8 py-16 lg:py-24 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Texto izquierda */}
          <motion.div
            className="flex-1 space-y-6 text-center lg:text-left"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {/* Label pill */}
            <span className="inline-block border border-primary text-primary text-xs font-body tracking-widest uppercase px-3 py-1 rounded-sm">
              Nueva Edición
            </span>

            {/* H1 */}
            <div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-text-primary leading-tight">
                San Diego{' '}
                <span className="italic text-text-secondary">La Revista</span>
              </h1>
              <p className="mt-3 text-text-secondary font-body text-xl">
                #{issue.issue_number}
              </p>
            </div>

            {/* CTA */}
            <div className="space-y-4">
              <Link
                href={`/revistas/san-diego-la-revista/${issue.issue_number}`}
                className="inline-flex items-center gap-2 bg-primary text-white py-4 px-8 rounded-sm font-body font-medium tracking-wide hover:bg-primary-dark hover:scale-[1.02] transition-all duration-200 text-base min-h-[52px]"
              >
                Leer edición completa
                <ArrowRight size={18} />
              </Link>

              {/* Trust mini */}
              <p className="text-text-muted text-sm font-body">
                • Acceso gratuito &nbsp;•&nbsp; Sin registro &nbsp;•&nbsp; Actualización mensual
              </p>
            </div>
          </motion.div>

          {/* Portada derecha */}
          <motion.div
            className="flex-shrink-0 w-full max-w-xs lg:max-w-sm xl:max-w-md"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          >
            <div className="relative group cursor-pointer rotate-[-2deg] hover:rotate-0 hover:scale-[1.02] transition-all duration-500">
              <div className="relative aspect-[3/4] w-full shadow-2xl rounded-sm overflow-hidden">
                <Image
                  src={issue.cover_url}
                  alt={`Portada ${issue.title}`}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 768px) 80vw, (max-width: 1200px) 40vw, 400px"
                />
              </div>
              {/* Sombra decorativa */}
              <div className="absolute -inset-4 bg-primary/5 rounded-sm -z-10 blur-xl" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
