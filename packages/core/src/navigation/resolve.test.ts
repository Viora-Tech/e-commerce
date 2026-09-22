import type { NavigationItem } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { itemHref, toNavLinks } from './resolve'

const item = (partial: Partial<NavigationItem> & Pick<NavigationItem, 'type'>): NavigationItem => ({
  id: 'i1',
  title: 'Untitled',
  ...partial,
})

describe('itemHref', () => {
  it('resolves a home item to the storefront root', () => {
    expect(itemHref(item({ type: 'home' }))).toBe('/')
  })

  it('prefixes the destination of a typed item with its route', () => {
    expect(itemHref(item({ type: 'product', value: 'claw-aquila-speed' }))).toBe(
      '/products/claw-aquila-speed',
    )
    expect(itemHref(item({ type: 'collection', value: 'glasspads' }))).toBe(
      '/collections/glasspads',
    )
    expect(itemHref(item({ type: 'page', value: 'about' }))).toBe('/pages/about')
  })

  it('takes a custom URL as written, on or off the store', () => {
    expect(itemHref(item({ type: 'url', value: '/collections/premium' }))).toBe(
      '/collections/premium',
    )
    expect(itemHref(item({ type: 'url', value: 'https://discord.gg/waimers' }))).toBe(
      'https://discord.gg/waimers',
    )
  })

  it('trims the value before building the path', () => {
    expect(itemHref(item({ type: 'collection', value: '  glasspads  ' }))).toBe(
      '/collections/glasspads',
    )
  })

  it('has no href when a typed item carries no destination', () => {
    expect(itemHref(item({ type: 'collection' }))).toBeNull()
    expect(itemHref(item({ type: 'collection', value: '' }))).toBeNull()
    expect(itemHref(item({ type: 'collection', value: '   ' }))).toBeNull()
    expect(itemHref(item({ type: 'url' }))).toBeNull()
  })
})

describe('toNavLinks', () => {
  it('renders each item as a label and href', () => {
    expect(
      toNavLinks([
        item({ id: 'a', title: 'Home', type: 'home' }),
        item({ id: 'b', title: 'Glasspads', type: 'collection', value: 'glasspads' }),
      ]),
    ).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Glasspads', href: '/collections/glasspads' },
    ])
  })

  it('drops an item with no destination rather than emitting a dead link', () => {
    expect(
      toNavLinks([
        item({ id: 'a', title: 'Glasspads', type: 'collection', value: 'glasspads' }),
        item({ id: 'b', title: 'Broken', type: 'collection' }),
      ]),
    ).toEqual([{ label: 'Glasspads', href: '/collections/glasspads' }])
  })

  it('keeps the order it was given', () => {
    const links = toNavLinks([
      item({ id: 'a', title: 'Third', type: 'url', value: '/3' }),
      item({ id: 'b', title: 'First', type: 'url', value: '/1' }),
    ])
    expect(links.map((l) => l.label)).toEqual(['Third', 'First'])
  })

  it('returns nothing for an empty menu', () => {
    expect(toNavLinks([])).toEqual([])
  })
})
