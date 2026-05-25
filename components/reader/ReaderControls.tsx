'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ReaderControlsProps {
  currentPage: number
  numPages: number
  onPrev: () => void
  onNext: () => void
  isLoading: boolean
}

export function ReaderControls({
  currentPage,
  numPages,
  onPrev,
  onNext,
  isLoading,
}: ReaderControlsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-t border-border">
      <div className="max-w-content mx-auto px-4 py-3 flex items-center justify-between">
        {/* Anterior */}
        <button
          onClick={onPrev}
          disabled={currentPage <= 1 || isLoading}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-body text-sm min-h-[44px] px-3"
        >
          <ChevronLeft size={18} />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        {/* Contador */}
        <div className="font-body text-sm text-white">
          {isLoading ? (
            <span className="text-text-muted">Cargando...</span>
          ) : (
            <>
              <span className="text-text-primary font-medium">{currentPage}</span>
              <span className="text-text-muted"> / {numPages}</span>
            </>
          )}
        </div>

        {/* Siguiente */}
        <button
          onClick={onNext}
          disabled={currentPage >= numPages || isLoading}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-body text-sm min-h-[44px] px-3"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
