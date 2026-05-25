'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AnimateOnScrollProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function AnimateOnScroll({
  children,
  delay = 0,
  className,
}: AnimateOnScrollProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, ease: 'easeOut', delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
