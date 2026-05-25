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
  const [editing, setEditing] = useState(false)
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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Barra de controles */}
      <div className="bg-[#0a0a0a]/98 backdrop-blur-md border-t border-white/8 h-16 flex items-center justify-between px-6 gap-4">

        {/* Botón anterior */}
        <button
          onClick={onPrev}
          disabled={currentPage <= 1 || isLoading}
          className="flex items-center gap-1.5 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors group"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[11px] tracking-[0.15em] uppercase hidden sm:block">Anterior</span>
        </button>

        {/* Contador de páginas — clickeable para ir directo */}
        <div className="flex flex-col items-center gap-0.5">
          {editing ? (
            <input
              type="number"
              value={inputVal}
              min={1}
              max={numPages}
              autoFocus
              onChange={e => setInputVal(e.target.value)}
              onBlur={handlePageSubmit}
              onKeyDown={e => { if (e.key === 'Enter') handlePageSubmit(); if (e.key === 'Escape') setEditing(false) }}
              className="w-16 text-center bg-white/10 text-white text-sm border border-white/20 rounded px-2 py-1 outline-none focus:border-[#C5A56B]"
            />
          ) : (
            <button
              onClick={handlePageClick}
              className="flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity"
              title="Clic para ir a una página"
            >
              {isLoading ? (
                <span className="text-white/20 text-[13px] tracking-widest">· · ·</span>
              ) : (
                <>
                  <span className="text-white text-[15px] font-light tabular-nums">
                    {currentPage}
                    <span className="text-white/25 mx-1">/</span>
                    {numPages || '—'}
                  </span>
                  <span className="text-white/25 text-[9px] tracking-[0.2em] uppercase">Página</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Botón siguiente */}
        <button
          onClick={onNext}
          disabled={!numPages || currentPage >= numPages || isLoading}
          className="flex items-center gap-1.5 text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors group"
          aria-label="Página siguiente"
        >
          <span className="text-[11px] tracking-[0.15em] uppercase hidden sm:block">Siguiente</span>
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  )
}