export function MarqueeStrip({ publications }: { publications: any[] }) {
  const items = publications.map((p: any) => p.name || 'Dework')
  // Números de edición reales: de la última de San Diego hacia atrás
  const ultima = publications.find((p: any) => p.slug === 'san-diego-la-revista')?.latest_issue?.issue_number ?? 144
  const editions = Array.from({ length: 10 }, (_, i) => `#${ultima - i}`)

  return (
    <div className="bg-[#16362B] py-3.5 overflow-hidden select-none">
      {/* Row 1 — publication names */}
      <div className="flex whitespace-nowrap mb-2" style={{ animation: 'marquee 32s linear infinite' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center shrink-0">
            {items.map((name: string, j: number) => (
              <span key={j} className="text-[#EAE2CF] text-[10px] tracking-[0.22em] uppercase mx-6">
                {name}<span className="ml-6 text-dw-gold">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      {/* Row 2 — edition numbers */}
      <div className="flex whitespace-nowrap" style={{ animation: 'marquee-reverse 40s linear infinite' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center shrink-0">
            {editions.map((n: string, j: number) => (
              <span key={j} className="font-display italic text-[#D9C29A] text-[11px] tracking-[0.2em] mx-6">
                {n}<span className="ml-6 text-[#B08D57]/60">·</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
