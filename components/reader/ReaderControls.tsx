'use client'

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
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur border-t border-dw-border h-14 flex items-center justify-center gap-8 px-6 z-50">
      <button onClick={onPrev} disabled={currentPage <= 1 || isLoading}
        className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text disabled:opacity-20 transition-colors">
        ← Anterior
      </button>
      <span className="text-dw-muted text-[11px] tracking-[0.1em]">
        {isLoading ? '...' : `${currentPage} / ${numPages || '—'}`}
      </span>
      <button onClick={onNext} disabled={!numPages || currentPage >= numPages || isLoading}
        className="text-dw-muted text-[11px] tracking-[0.15em] uppercase hover:text-dw-text disabled:opacity-20 transition-colors">
        Siguiente →
      </button>
    </div>
  )
}
