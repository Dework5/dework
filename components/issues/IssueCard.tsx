'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { Issue } from '@/lib/types'

interface IssueCardProps {
  issue: Issue
  slug: string
  index?: number
}

export function IssueCard({ issue, slug, index = 0 }: IssueCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.1 }}
    >
      <Link href={`/revistas/${slug}/${issue.issue_number}`} className="group block">
        <div className="bg-surface-elevated border border-border rounded-sm overflow-hidden hover:-translate-y-[3px] hover:border-text-muted transition-all duration-200 hover:shadow-xl">
          {/* Portada */}
          <div className="relative aspect-[3/4] w-full overflow-hidden">
            <Image
              src={issue.cover_url}
              alt={`Portada ${issue.title}`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />
            {/* Badge número */}
            <div className="absolute top-2 left-2 bg-black/70 text-text-secondary text-xs font-body px-2 py-1 rounded-sm">
              #{issue.issue_number}
            </div>
            {/* Overlay hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center gap-2 text-white">
                <BookOpen size={28} />
                <span className="text-xs font-body tracking-wide uppercase">Leer</span>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="p-4">
            <p className="text-text-secondary text-sm font-body leading-snug line-clamp-2">
              {issue.title}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
