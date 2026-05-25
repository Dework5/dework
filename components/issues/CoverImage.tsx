'use client'

import { useState } from 'react'
import Image from 'next/image'

interface CoverImageProps {
  src: string | null
  alt: string
  issueNumber: number
  shortName: string
}

export function CoverImage({ src, alt, issueNumber, shortName }: CoverImageProps) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="absolute inset-0 bg-dw-surface flex flex-col items-center justify-center gap-1">
        <span className="font-display italic text-dw-border text-4xl">
          #{issueNumber}
        </span>
        <span className="text-dw-muted text-[9px] tracking-widest uppercase">
          {shortName}
        </span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      onError={() => setFailed(true)}
    />
  )
}
