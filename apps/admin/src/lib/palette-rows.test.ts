import { Plus } from '@commerce/ui/icons'
import { describe, expect, it } from 'vitest'
import { paletteContent } from '@/data/command-palette'
import {
  type BuildInput,
  buildSections,
  flattenRows,
  type OrderHit,
  resultCount,
  rowHref,
  rowRecent,
} from './palette-rows'

const order = (n: number): OrderHit => ({
  id: `o${n}`,
  number: n,
  customerName: 'Ali',
  status: 'open',
  totalPaise: 1000,
  placedAt: new Date('2026-10-01'),
  imageUrl: null,
})

const base: BuildInput = {
  query: '',
  scope: 'all',
  copy: paletteContent,
  aiEnabled: true,
  recents: [],
  orders: null,
  products: null,
  customers: null,
  actions: [{ href: '/products/new', label: 'Create product', icon: Plus }],
  pages: [{ href: '/orders', label: 'Orders', icon: Plus }],
  settings: [],
  themeLabel: null,
  listHrefs: { orders: '/orders', products: '/products', customers: '/customers' },
}

const keys = (input: Partial<BuildInput>) => buildSections({ ...base, ...input }).map((s) => s.key)

describe('buildSections', () => {
  it('lists recents, quick actions and pages when nothing is typed', () => {
    expect(keys({})).toEqual(['actions', 'goTo'])
    expect(keys({ recents: [{ label: 'Orders', href: '/orders' }] })).toEqual([
      'recent',
      'actions',
      'goTo',
    ])
  })

  it('puts Ask AI first when there is a query, and leaves it out when AI is off', () => {
    const on = buildSections({ ...base, query: 'ali' })
    expect(on[0]?.key).toBe('ask')
    expect(flattenRows(on)[0]).toMatchObject({ kind: 'ask', query: 'ali' })
    expect(keys({ query: 'ali', aiEnabled: false })).not.toContain('ask')
  })

  it('shows five records per group on All with See all N when there are more', () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map(order)
    const sections = buildSections({ ...base, query: 'ali', orders: { items, total: 42 } })
    const orders = sections.find((s) => s.key === 'orders')
    expect(orders?.count).toBe(42)
    expect(orders?.rows.filter((r) => r.kind === 'order')).toHaveLength(5)
    const more = orders?.rows.at(-1)
    expect(more).toMatchObject({ kind: 'more', href: '/orders?query=ali' })
    expect(more && 'label' in more ? more.label : '').toBe('See all 42 →')
  })

  it('shows ten in one scope and no See all when everything fits', () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map(order)
    const sections = buildSections({
      ...base,
      query: 'ali',
      scope: 'orders',
      orders: { items, total: 7 },
    })
    expect(sections.map((s) => s.key)).toEqual(['ask', 'orders'])
    expect(sections[1]?.rows).toHaveLength(7)
    expect(sections[1]?.rows.some((r) => r.kind === 'more')).toBe(false)
  })

  it('offers the full list for a record scope with nothing typed', () => {
    const [section] = buildSections({ ...base, scope: 'customers' })
    expect(section?.rows[0]).toMatchObject({ kind: 'more', href: '/customers' })
  })

  it('keeps quick actions out of a single record scope', () => {
    expect(keys({ query: 'create', scope: 'orders' })).toEqual(['ask'])
    expect(keys({ query: 'create' })).toContain('actions')
  })
})

describe('row helpers', () => {
  it('counts found things only, not Ask AI or See all', () => {
    const sections = buildSections({
      ...base,
      query: 'ali',
      orders: { items: [order(1), order(2)], total: 9 },
      actions: [],
      pages: [],
    })
    expect(resultCount(sections)).toBe(2)
  })

  it('knows where a row goes and what to remember', () => {
    const [ask, o] = flattenRows(
      buildSections({ ...base, query: 'ali', orders: { items: [order(7)], total: 1 } }),
    )
    expect(ask && rowHref(ask)).toBeNull()
    expect(o && rowHref(o)).toBe('/orders/o7')
    expect(
      o && rowRecent(o, { order: 'Orders', product: 'Products', customer: 'Customers' }),
    ).toEqual({
      label: '#7',
      href: '/orders/o7',
      hint: 'Orders',
    })
    expect(ask && rowRecent(ask, { order: '', product: '', customer: '' })).toBeNull()
  })
})
