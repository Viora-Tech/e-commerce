import { describe, expect, it } from 'vitest'
import { liquidShim } from './liquid-shim'

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
function boot() {
  const fetched: string[] = []
  const win = {
    Node: FakeNode,
    fetch: (input: string) => {
      fetched.push(input)
      return Promise.resolve(new Response('{}'))
    },
  } as unknown as Window & { Node: typeof FakeNode }
  const location = new URL('https://shop.example/collections/all')
  new Function('window', 'location', liquidShim({ askConsent: false }))(win, location)
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
