'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ReaderControlsProps {
  currentPage: number
  numPages:    number
  onPrev:      () => void
  onNext:      () => void
  onGoTo:      (p: number) => void
  isLoading:   boolean
}

export function ReaderControls({
  currentPage, numPages, onPrev, onNext, onGoTo, isLoading,
}: ReaderControlsProps) {
  const [editing,  setEditing]  = useState(false)
  const [inputVal, setInputVal] = useState('')

  const handlePageClick = () => {
    if (isLoading || numPages === 0) return
    setInputVal(String(currentPage))
    setEditing(true)
  }

  const handlePageSubmit = () => {
    const p = parseInt(inputVal)
    if (!isNaN(p) && p >= 1 && p <= numPages) onGoTo(p)
    setEditing(false)
  }

  const pct = numPages > 1 ? Math.round(((currentPage - 1) / (numPages - 1)) * 100) : 0

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Línea de progreso encima de la barra */}
      <div className="h-[2px] bg-black/6 w-full">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: '#C5A56B' }}
        />
      </div>

      {/* Barra de navegación */}
      <div
        className="flex items-center justify-between px-4 sm:px-8"
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          height: 64,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Anterior */}
        <button
          onClick={onPrev}
          disabled={currentPage <= 1 || isLoading}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors group min-w-[80px]"
          aria-label="Página anterior"
        >
          <ChevronLeft
            size={18}
            className="group-hover:-translate-x-0.5 transition-transform flex-shrink-0"
          />
          <span className="text-[11px] tracking-[0.15em] uppercase font-medium hidden sm:block">
            Anterior
          </span>
        </button>

        {/* Contador central */}
        <div className="flex flex-col items-center justify-center gap-0.5 flex-1">
          {editing ? (
            <input
              type="number"
              value={inputVal}
              min={1}
              max={numPages}
              autoFocus
              onChange={e => setInputVal(e.target.value)}
              onBlur={handlePageSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter') handlePageSubmit()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="w-16 text-center bg-gray-50 text-gray-900 text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-[#C5A56B] focus:ring-1 focus:ring-[#C5A56B]/30"
            />
          ) : (
            <button
              onClick={handlePageClick}
              className="flex flex-col items-center gap-0 hover:opacity-70 transition-opacity cursor-pointer"
              title="Clic para saltar a una página"
              disabled={isLoading || numPages === 0}
            >
              {isLoading ? (
                <span className="text-gray-300 text-sm tracking-widest">· · ·</span>
              ) : (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-gray-900 text-[17px] font-light tabular-nums leading-none">
                      {currentPage}
                    </span>
                    <span className="text-gray-300 text-sm leading-none">/</span>
                    <span className="text-gray-400 text-[13px] font-light tabular-nums leading-none">
                      {numPages || '—'}
                    </span>
                  </div>
                  <span className="text-gray-300 text-[9px] tracking-[0.25em] uppercase mt-1">
                    página
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Siguiente */}
        <button
          onClick={onNext}
          disabled={!numPages || currentPage >= numPages || isLoading}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors group min-w-[80px] justify-end"
          aria-label="Página siguiente"
        >
          <span className="text-[11px] tracking-[0.15em] uppercase font-medium hidden sm:block">
            Siguiente
          </span>
          <ChevronRight
            size={18}
            className="group-hover:translate-x-0.5 transition-transform flex-shrink-0"
          />
        </button>
      </div>
    </div>
  )
}
