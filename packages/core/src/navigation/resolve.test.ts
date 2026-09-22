import type { NavigationItem } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { MenuItemsSchema } from './items'
import { itemHref, toFooterColumns, toNavLinks } from './resolve'

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

describe('nested menus', () => {
  const nested = [
    item({
      id: 'shop',
      title: 'Shop',
      type: 'url',
      value: '/collections/all',
      children: [
        item({
          id: 'pads',
          title: 'Mousepads',
          type: 'collection',
          value: 'mousepads',
          children: [
            item({ id: 'glass', title: 'Glasspads', type: 'collection', value: 'glasspads' }),
          ],
        }),
        item({ id: 'mice', title: 'Mice', type: 'collection', value: 'mice' }),
      ],
    }),
    item({ id: 'support', title: 'Support', type: 'page', value: 'support' }),
  ]

  it('resolves children recursively and omits empty child lists', () => {
    expect(toNavLinks(nested)).toEqual([
      {
        label: 'Shop',
        href: '/collections/all',
        children: [
          {
            label: 'Mousepads',
            href: '/collections/mousepads',
            children: [{ label: 'Glasspads', href: '/collections/glasspads' }],
          },
          { label: 'Mice', href: '/collections/mice' },
        ],
      },
      { label: 'Support', href: '/pages/support' },
    ])
  })

  it('drops an unresolvable parent together with its children', () => {
    const links = toNavLinks([
      item({
        id: 'p',
        title: 'Broken',
        type: 'page',
        children: [item({ id: 'c', title: 'Kid', type: 'home' })],
      }),
    ])
    expect(links).toEqual([])
  })

  it('turns nested footer menus into one column per parent, loose links under the menu title', () => {
    expect(toFooterColumns('Footer', nested)).toEqual([
      { heading: 'Footer', links: [{ label: 'Support', href: '/pages/support' }] },
      {
        heading: 'Shop',
        links: [
          { label: 'Mousepads', href: '/collections/mousepads' },
          { label: 'Mice', href: '/collections/mice' },
        ],
      },
    ])
  })

  it('keeps a flat footer menu as a single column', () => {
    const flat = [item({ id: 'a', title: 'About', type: 'page', value: 'about' })]
    expect(toFooterColumns('Company', flat)).toEqual([
      { heading: 'Company', links: [{ label: 'About', href: '/pages/about' }] },
    ])
    expect(toFooterColumns('Empty', [])).toEqual([])
  })
})

describe('MenuItemsSchema', () => {
  it('accepts three levels', () => {
    expect(
      MenuItemsSchema.safeParse([
        {
          id: 'a',
          title: 'A',
          type: 'home',
          children: [
            {
              id: 'b',
              title: 'B',
              type: 'home',
              children: [{ id: 'c', title: 'C', type: 'home' }],
            },
          ],
        },
      ]).success,
    ).toBe(true)
  })

  it('rejects a fourth level', () => {
    const result = MenuItemsSchema.safeParse([
      {
        id: 'a',
        title: 'A',
        type: 'home',
        children: [
          {
            id: 'b',
            title: 'B',
            type: 'home',
            children: [
              {
                id: 'c',
                title: 'C',
                type: 'home',
                children: [{ id: 'd', title: 'D', type: 'home' }],
              },
            ],
          },
        ],
      },
    ])
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/3 levels/)
  })

  it('rejects a repeated id anywhere in the tree', () => {
    const result = MenuItemsSchema.safeParse([
      { id: 'a', title: 'A', type: 'home', children: [{ id: 'a', title: 'Again', type: 'home' }] },
    ])
    expect(result.success).toBe(false)
  })

  it('still requires a destination on nested items', () => {
    const result = MenuItemsSchema.safeParse([
      { id: 'a', title: 'A', type: 'home', children: [{ id: 'b', title: 'B', type: 'page' }] },
    ])
    expect(result.success).toBe(false)
  })
})
