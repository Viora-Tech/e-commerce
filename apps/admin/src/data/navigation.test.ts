import { describe, expect, it } from 'vitest'
import { routes } from '@/lib/routes'
import { activeChildHref } from './navigation'

const children = [
  { href: routes.products.list(), label: 'All products' },
  { href: routes.stock.purchaseOrders(), label: 'Purchase orders' },
]

describe('activeChildHref', () => {
  it('lights only the most specific child', () => {
    expect(activeChildHref(`${routes.stock.purchaseOrders()}/abc`, children)).toBe(
      routes.stock.purchaseOrders(),
    )
  })

  it('keeps the broad child for its own pages', () => {
    expect(activeChildHref(`${routes.products.list()}/abc`, children)).toBe(routes.products.list())
  })

  it('returns null when nothing matches', () => {
    expect(activeChildHref('/orders', children)).toBeNull()
  })
})
