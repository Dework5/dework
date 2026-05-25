import { ReactNode } from 'react'

interface ContainerProps {
  children: ReactNode
  className?: string
}

export function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`max-w-content mx-auto px-4 md:px-8 ${className}`}>
      {children}
    </div>
  )
}
