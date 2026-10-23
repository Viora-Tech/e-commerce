/** SOURCE OF TRUTH: app catalogue tests — WHAT: prices, ordering, search and filters of the App Store catalogue / WHY: the App Store site lists apps from these helpers */
import { describe, expect, it } from 'vitest'
import {
  appInstallPath,
  appPrice,
  catalogueApp,
  catalogueApps,
  catalogueCategories,
  filterCatalogue,
  matchesAppQuery,
  relatedApps,
} from './catalogue'

describe('app catalogue', () => {
  it('prices paid apps from APP_PRICING and everything else as free', () => {
    expect(appPrice('reviews')).toEqual({
      kind: 'paid',
      includedFrom: 'growth',
      pricePaise: 199_00,
    })
    expect(appPrice('delhivery')).toEqual({ kind: 'free' })
  })

  it('lists our own apps first, then connections, each by name', () => {
    const apps = catalogueApps()
    const firstConnection = apps.findIndex((a) => a.kind === 'connection')
    expect(apps.slice(0, firstConnection).every((a) => a.kind === 'builtin')).toBe(true)
    expect(apps.slice(firstConnection).every((a) => a.kind === 'connection')).toBe(true)
    expect(new Set(apps.map((a) => a.id)).size).toBe(apps.length)
  })

  it('counts each category once, shipping first', () => {
    const categories = catalogueCategories()
    expect(categories[0]?.slug).toBe('shipping')
    expect(categories.reduce((n, c) => n + c.count, 0)).toBe(catalogueApps().length)
  })

  it('searches every word across name, tagline, highlights and keywords', () => {
    const gst = catalogueApp('gst-invoices')
    if (!gst) throw new Error('gst-invoices is listed')
    expect(matchesAppQuery(gst, 'GSTR-1')).toBe(true)
    expect(matchesAppQuery(gst, 'gst courier')).toBe(false)
    expect(matchesAppQuery(gst, '  ')).toBe(true)
  })

  it('filters by category, price and maker', () => {
    const apps = catalogueApps()
    const paid = filterCatalogue(apps, { price: 'paid' })
    expect(paid.length).toBeGreaterThan(0)
    expect(paid.every((a) => a.price.kind === 'paid')).toBe(true)
    expect(filterCatalogue(apps, { ours: true }).every((a) => a.kind === 'builtin')).toBe(true)
    const couriers = filterCatalogue(apps, { category: 'shipping', query: 'courier' })
    expect(couriers.map((a) => a.id)).toContain('delhivery')
  })

  it('suggests apps from the same category', () => {
    const delhivery = catalogueApp('delhivery')
    if (!delhivery) throw new Error('delhivery is listed')
    const related = relatedApps(delhivery)
    expect(related.length).toBe(3)
    expect(related.every((a) => a.category === 'shipping' && a.id !== 'delhivery')).toBe(true)
  })

  it('links Install to the admin install flow', () => {
    expect(appInstallPath('back-in-stock')).toBe('/apps/install?app=back-in-stock')
  })
})
