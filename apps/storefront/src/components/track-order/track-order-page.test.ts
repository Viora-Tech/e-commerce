/** SOURCE OF TRUTH: /track-order for signed-in shoppers — WHAT: recent orders above the lookup, signed-out page unchanged, never shared-cached / WHY: owner, 27 Nov 2026 (Shopify's order status lookup shows a signed-in customer's orders) */
import type { ShopperOrderSummary } from '@commerce/core'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { edgeCacheControl } from '@/lib/edge-cache'

const session = vi.hoisted(() => ({
  me: null as null | { id: string; email: string | null },
  orders: [] as unknown[],
  listed: [] as unknown[],
}))

vi.mock('@commerce/core', () => ({
  listCustomerOrders: vi.fn(async (_ctx: unknown, customerId: string, opts: unknown) => {
    session.listed.push({ customerId, opts })
    return session.orders
  }),
}))
vi.mock('@/lib/customer-session', () => ({ currentCustomer: vi.fn(async () => session.me) }))
vi.mock('@/lib/store-context', () => ({
  inStore: (_storeId: string, fn: (tx: unknown) => unknown) => fn({}),
}))
vi.mock('@/lib/account', () => ({ storeTimeZone: async () => 'Asia/Kolkata' }))
vi.mock('@/lib/seo', () => ({ marketCanonical: async (p: string) => p }))
vi.mock('@/lib/track-order-actions', () => ({ trackOrderAction: vi.fn() }))
// The real frame is async (it reads the store's checkout look); the `.ck` scope is what matters.
vi.mock('@/components/account/account-frame', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}))

const page = await import('@/app/-s/[storeId]/track-order/page')
const TrackOrderPage = page.default

const order = (over: Partial<ShopperOrderSummary> = {}): ShopperOrderSummary => ({
  id: 'o1',
  number: 1042,
  placedAt: new Date('2026-10-12T10:00:00Z'),
  status: 'open',
  paymentStatus: 'paid',
  fulfillmentStatus: 'fulfilled',
  totalPaise: 1_034_600,
  itemCount: 3,
  payment: 'paid',
  shipment: 'in_transit',
  firstImage: null,
  thumbnails: [],
  ...over,
})

const render = async () =>
  renderToStaticMarkup(await TrackOrderPage({ params: Promise.resolve({ storeId: 's1' }) }))

beforeEach(() => {
  session.me = null
  session.orders = []
  session.listed = []
})

describe('Track order page', () => {
  it('signed out: the lookup alone, with its sign-in line, and no order query', async () => {
    const html = await render()
    expect(html).toContain('<h1 class="track-order__title">Track your order</h1>')
    expect(html).toContain('Sign in to see all orders')
    expect(html).not.toContain('Track another order')
    expect(html).not.toContain('/account/orders/')
    expect(session.listed).toEqual([])
  })

  it('signed in: the latest orders as on /account, then "Track another order"', async () => {
    session.me = { id: 'c1', email: 'a@b.in' }
    session.orders = [
      order(),
      order({ id: 'o2', number: 1043, itemCount: 1, shipment: 'unfulfilled', totalPaise: 99_900 }),
    ]
    const html = await render()
    expect(session.listed).toEqual([{ customerId: 'c1', opts: { limit: 5 } }])
    // One page title; the lookup drops to a second-level heading.
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('Track your order')
    expect(html).toContain('View all orders')
    expect(html).toContain('href="/account/orders/1042"')
    expect(html).toContain('href="/account/orders/1043"')
    expect(html).toContain('Order #1042')
    expect(html).toContain('3 items')
    expect(html).toContain('1 item')
    expect(html).toContain('<h2 class="track-order__title">Track another order</h2>')
    expect(html).not.toContain('Sign in to see all orders')
    // Lookup comes after the list.
    expect(html.indexOf('Order #1043')).toBeLessThan(html.indexOf('Track another order'))
  })

  it('signed in without orders: the lookup alone, not asked to sign in', async () => {
    session.me = { id: 'c1', email: 'a@b.in' }
    const html = await render()
    expect(html).toContain('<h1 class="track-order__title">Track your order</h1>')
    expect(html).not.toContain('Sign in to see all orders')
    expect(html).not.toContain('View all orders')
  })

  it('stays a per-request page: no static or revalidate export', () => {
    const mod = page as Record<string, unknown>
    expect(mod.dynamic).toBeUndefined()
    expect(mod.revalidate).toBeUndefined()
  })

  it('is never kept by a shared cache, signed in or not', () => {
    const base = { method: 'GET', pathname: '/track-order', rsc: false, personal: false }
    expect(edgeCacheControl({ ...base, cookieNames: ['wc_customer'], ttlSeconds: 300 })).toBeNull()
    expect(edgeCacheControl({ ...base, cookieNames: [], ttlSeconds: 300 })).toBeNull()
  })
})
