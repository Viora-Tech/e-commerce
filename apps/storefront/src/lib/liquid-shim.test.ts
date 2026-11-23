import { describe, expect, it } from 'vitest'
import { type LiquidShimConfig, liquidShim, shimPreview } from './liquid-shim'

/** Just enough of a DOM node for the shim's patch: children in order, a parent, the DOM's errors. */
class FakeNode {
  parentNode: FakeNode | null = null
  children: FakeNode[] = []

  constructor(readonly name: string) {}

  removeChild(child: FakeNode): FakeNode {
    const at = this.children.indexOf(child)
    if (at < 0) throw new Error('NotFoundError: not a child of this node')
    this.children.splice(at, 1)
    child.parentNode = null
    return child
  }

  insertBefore(node: FakeNode, ref: FakeNode | null): FakeNode {
    if (ref && ref.parentNode !== this) throw new Error('NotFoundError: not a child of this node')
    node.parentNode?.removeChild(node)
    this.children.splice(ref ? this.children.indexOf(ref) : this.children.length, 0, node)
    node.parentNode = this
    return node
  }
}

const names = (node: FakeNode) => node.children.map((c) => c.name)

/** Runs the shim against a fake window; returns the URLs its fetch handed to the network. */
function boot(config: Partial<LiquidShimConfig> = {}) {
  const fetched: string[] = []
  const win = {
    Node: FakeNode,
    fetch: (input: string) => {
      fetched.push(input)
      return Promise.resolve(new Response('{}'))
    },
  } as unknown as Window & { Node: typeof FakeNode }
  const location = new URL('https://shop.example/collections/all')
  new Function('window', 'location', liquidShim({ askConsent: false, ...config }))(win, location)
  return { win, fetched }
}

describe('nodes a theme script moved', () => {
  boot()

  it('are removed from where the theme put them, not thrown over', () => {
    // A reveal moved the heading's words into its own span; React then removes them.
    const heading = new FakeNode('h1')
    const words = new FakeNode('#text')
    heading.insertBefore(words, null)
    const inner = new FakeNode('span')
    inner.insertBefore(words, null)
    heading.insertBefore(inner, null)

    expect(heading.removeChild(words)).toBe(words)
    expect(names(inner)).toEqual([])
    expect(names(heading)).toEqual(['span'])
  })

  it('are inserted beside where the theme put the sibling', () => {
    const heading = new FakeNode('h1')
    const inner = new FakeNode('span')
    const count = new FakeNode('count')
    inner.insertBefore(count, null)
    heading.insertBefore(inner, null)

    heading.insertBefore(new FakeNode('#text'), count)
    expect(names(inner)).toEqual(['#text', 'count'])
  })

  it('leave ordinary removes and inserts alone', () => {
    const list = new FakeNode('ul')
    const a = new FakeNode('a')
    list.insertBefore(a, null)
    list.insertBefore(new FakeNode('b'), a)
    expect(names(list)).toEqual(['b', 'a'])
    list.removeChild(a)
    expect(names(list)).toEqual(['b'])
    // A node that was never anywhere has nothing to remove.
    expect(list.removeChild(new FakeNode('stray'))).toBeInstanceOf(FakeNode)
  })
})

describe('section rendering through the shim', () => {
  it('asks for every section of a `?sections=` list', async () => {
    const { win, fetched } = boot()
    await win.fetch('/collections/all?sections=cart-icon-bubble,main-cart-items')
    const url = new URL(fetched[0] ?? '', 'https://shop.example')
    expect(url.pathname).toBe('/theme-actions/section')
    expect(url.searchParams.get('sections')).toBe('cart-icon-bubble,main-cart-items')
    expect(url.searchParams.has('section_id')).toBe(false)
    expect(url.searchParams.get('path')).toBe('/collections/all')
  })

  it('keeps `?section_id=` a single section', async () => {
    const { win, fetched } = boot()
    await win.fetch('/products/mat?section_id=tab-panel-cards')
    const url = new URL(fetched[0] ?? '', 'https://shop.example')
    expect(url.searchParams.get('section_id')).toBe('tab-panel-cards')
    expect(url.searchParams.has('sections')).toBe(false)
    expect(url.searchParams.get('path')).toBe('/products/mat')
  })
})

describe('consent through the shim', () => {
  it('keeps the answer for a listener that is not there yet, and still sends the event', () => {
    const sent: unknown[] = []
    const win = {
      Node: FakeNode,
      fetch: () => Promise.resolve(new Response('{}')),
      dispatchEvent: (e: CustomEvent) => sent.push(e.detail),
    } as unknown as Window & {
      Shopify: { customerPrivacy: { setTrackingConsent: (c: unknown, d: () => void) => void } }
      __commerceConsentAnswer?: unknown
    }
    const location = new URL('https://shop.example/')
    new Function('window', 'location', liquidShim({ askConsent: true }))(win, location)
    win.Shopify.customerPrivacy.setTrackingConsent({ analytics: true, marketing: 0 }, () => {})
    expect(win.__commerceConsentAnswer).toEqual({ analytics: true, marketing: false })
    expect(sent).toEqual([{ analytics: true, marketing: false }])
  })
})

describe("Customize's design mode", () => {
  const shimmed = (designMode?: boolean) => {
    const win = {
      Node: FakeNode,
      fetch: () => Promise.resolve(new Response('{}')),
    } as unknown as Window & {
      Shopify?: { designMode?: boolean }
    }
    const config =
      designMode === undefined ? { askConsent: false } : { askConsent: false, designMode }
    new Function('window', 'location', liquidShim(config))(win, new URL('https://shop.example/'))
    return win.Shopify
  }

  it('sets Shopify.designMode only on the editor frame', () => {
    expect(shimmed(true)?.designMode).toBe(true)
    expect(shimmed(false)?.designMode).toBeUndefined()
    expect(shimmed()?.designMode).toBeUndefined()
  })
})

describe('a previewed page in a frame (Customize, the Themes page)', () => {
  const VERSION = '01a1ad79-1023-7366-85dd-d8da62b44369'

  it('sends section rendering with the preview and its version', async () => {
    const { win, fetched } = boot({ preview: { token: 'tok.en', version: VERSION } })
    await win.fetch('/collections/all?filter.v.availability=1&section_id=guide-results')
    const url = new URL(fetched[0] ?? '', 'https://shop.example')
    expect(url.pathname).toBe('/theme-actions/section')
    expect(url.searchParams.get('section_id')).toBe('guide-results')
    expect(url.searchParams.get('filter.v.availability')).toBe('1')
    expect(url.searchParams.get('theme-preview')).toBe('tok.en')
    expect(url.searchParams.get('theme-version')).toBe(VERSION)
  })

  it('sends predictive search and recommendations with the preview', async () => {
    const { win, fetched } = boot({ preview: { token: 'tok.en' } })
    await win.fetch('/search/suggest?q=mat&section_id=predictive-search')
    await win.fetch('/recommendations/products?product_id=1&section_id=related')
    for (const href of fetched) {
      const url = new URL(href, 'https://shop.example')
      expect(url.searchParams.get('theme-preview')).toBe('tok.en')
      expect(url.searchParams.has('theme-version')).toBe(false)
    }
    expect(fetched[0]?.startsWith('/search/suggest?')).toBe(true)
  })

  it('leaves the live store and other calls without it', async () => {
    const live = boot()
    await live.win.fetch('/collections/all?section_id=guide-results')
    expect(live.fetched[0]).not.toContain('theme-preview')
    const previewed = boot({ preview: { token: 'tok.en' } })
    await previewed.win.fetch('/cart.js')
    await previewed.win.fetch('https://cdn.example/x.js?section_id=a')
    expect(previewed.fetched.join(' ')).not.toContain('theme-preview')
  })

  it('reads the preview from the proxy headers only when there is one', () => {
    expect(shimPreview(null)).toBeUndefined()
    expect(shimPreview(new Headers())).toBeUndefined()
    expect(shimPreview(new Headers({ 'x-theme-preview': 't' }))).toEqual({ token: 't' })
    const both = new Headers({ 'x-theme-preview': 't', 'x-theme-version': VERSION })
    expect(shimPreview(both)).toEqual({ token: 't', version: VERSION })
  })
})
