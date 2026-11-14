import { Blocks } from '@commerce/ui/icons'
import { describe, expect, it } from 'vitest'
import { routes } from '@/lib/routes'
import { activeChildHref, isSectionActive, isSectionLinkActive } from './navigation'

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

describe('an installed app row (Figma 928:10728)', () => {
  const pages = [
    { href: '/apps/gst-invoices', label: 'Queue' },
    { href: '/apps/gst-invoices/invoices', label: 'Invoices' },
  ]
  const gst = {
    href: '/apps/gst-invoices',
    label: 'GST invoices',
    icon: Blocks,
    base: '/apps/gst-invoices',
    children: pages,
  }
  const payments = {
    href: '/settings/payments',
    label: 'Razorpay',
    icon: Blocks,
    base: '/apps/razorpay',
  }

  it('is active on its pages and lights the most specific page', () => {
    expect(isSectionActive('/apps/gst-invoices/invoices/abc', gst)).toBe(true)
    expect(activeChildHref('/apps/gst-invoices/invoices/abc', pages)).toBe(
      '/apps/gst-invoices/invoices',
    )
    expect(isSectionLinkActive('/apps/gst-invoices', gst)).toBe(false)
  })

  it('View more lights only on the apps list, not on an app of its own', () => {
    const viewMore = {
      href: '/apps',
      label: 'View more',
      icon: Blocks,
      excludes: ['/apps/rapidshyp', '/apps/razorpay'],
    }
    expect(isSectionActive('/apps', viewMore)).toBe(true)
    expect(isSectionActive('/apps/rapidshyp', viewMore)).toBe(false)
    expect(isSectionActive('/apps/razorpay/connect', viewMore)).toBe(false)
  })

  it('is active under its base, not under a shared settings page', () => {
    expect(isSectionActive('/settings/payments', payments)).toBe(false)
    expect(isSectionActive('/apps/razorpay/connect', payments)).toBe(true)
    expect(isSectionActive('/apps/gst-invoices', payments)).toBe(false)
  })
})
