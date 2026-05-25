export function MarqueeStrip({ publications }: { publications: any[] }) {
  const items = publications.map((p: any) => p.name || 'Dework')
  const editions = ['#139','#138','#137','#136','#135','#134','#133','#132','#131','#130']

  return (
    <div className="bg-dw-surface border-y border-dw-border py-3.5 overflow-hidden select-none">
      {/* Row 1 — publication names */}
      <div className="flex whitespace-nowrap mb-2" style={{ animation: 'marquee 32s linear infinite' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center shrink-0">
            {items.map((name: string, j: number) => (
              <span key={j} className="text-dw-muted text-[10px] tracking-[0.22em] uppercase mx-6">
                {name}<span className="ml-6 text-dw-border">·</span>
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
              <span key={j} className="font-display italic text-dw-border text-[10px] tracking-[0.2em] mx-6">
                {n}<span className="ml-6 text-dw-hover">·</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
