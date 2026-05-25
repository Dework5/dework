import { ReactNode } from 'react'
import Link from 'next/link'

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  className?: string
  external?: boolean
}

export function Button({
  children,
  variant = 'primary',
  href,
  onClick,
  type = 'button',
  disabled,
  className = '',
  external,
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 min-h-[48px] font-body font-medium tracking-wide transition-all duration-200 rounded-sm'

  const variants = {
    primary:
      'bg-primary text-white py-3 px-8 hover:bg-primary-dark hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed',
    secondary:
      'border border-border text-text-primary py-3 px-8 hover:border-text-secondary',
    ghost: 'text-text-secondary hover:text-text-primary px-4 py-2',
  }

  const classes = `${base} ${variants[variant]} ${className}`

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
          {children}
        </a>
      )
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  )
}
