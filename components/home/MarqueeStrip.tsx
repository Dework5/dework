export function MarqueeStrip({ publications }: { publications: any[] }) {
  const items = publications.map((p: any) => p.name || 'Dework')
  return (
    <div className="bg-dw-surface border-y border-dw-border py-3.5 overflow-hidden select-none">
      <div className="flex whitespace-nowrap mb-2" style={{ animation: 'marquee 28s linear infinite' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center shrink-0">
            {items.map((name: string, j: number) => (
              <span key={j} className="text-dw-muted text-[10px] tracking-[0.22em] uppercase mx-5">
                {name}<span className="ml-5 text-dw-border">·</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="flex whitespace-nowrap" style={{ animation: 'marquee-reverse 36s linear infinite' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center shrink-0">
            {['#139','#138','#137','#136','#135','#134','#133','#132','#131','#130'].map((n: string, j: number) => (
              <span key={j} className="font-display italic text-dw-border text-[10px] tracking-[0.2em] mx-5">
                {n}<span className="ml-5 text-dw-hover">·</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
