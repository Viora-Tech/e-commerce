import { afterEach } from 'vitest'

// Setup for component tests (files marked `// @vitest-environment jsdom`); a no-op for the
// plain Node tests. jsdom has no layout, so the browser APIs our UI kit (Base UI, cmdk,
// Motion) reaches for are stubbed with inert versions, and every test unmounts what it drew.
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => cleanup())

  class InertObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  window.ResizeObserver ??= InertObserver as unknown as typeof ResizeObserver
  window.IntersectionObserver ??= InertObserver as unknown as typeof IntersectionObserver
  Element.prototype.scrollIntoView ??= () => undefined
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => undefined
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}
