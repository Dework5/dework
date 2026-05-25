declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>)
    loadFromHTML(items: NodeListOf<Element>): void
    on(event: string, callback: (e: { data: number }) => void): void
    flipNext(): void
    flipPrev(): void
    flip(page: number): void
    destroy(): void
    getCurrentPageIndex(): number
  }
  export default PageFlip
}
