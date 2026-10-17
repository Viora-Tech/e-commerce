import { describe, expect, it } from 'vitest'
import { SETTINGS_SEARCH_INDEX } from '@/data/settings-search'
import { SETTINGS_REDIRECTS } from './settings-redirects'
import { searchSettings } from './settings-search'

const first = (q: string) => searchSettings(SETTINGS_SEARCH_INDEX, q)[0]

describe('searchSettings', () => {
  it('finds pages by the short forms shop owners type', () => {
    expect(first('UPI')?.href).toBe('/settings/payments')
    expect(first('cod')?.href).toBe('/settings/payments')
    expect(first('GST')?.href).toBe('/settings/taxes')
    expect(first('invoice number')?.href).toBe('/settings/taxes?tab=invoices#invoice-numbers')
    expect(first('irn')?.where).toBe('Taxes & GST › GST & invoices')
    expect(first('whatsapp')?.where).toBe('Messages › Notifications')
  })

  it('finds GST numbers (once Business and GST) on the Taxes & GST page, and Locations', () => {
    expect(first('PAN')?.href).toBe('/settings/taxes')
    expect(first('gst rate')?.href).toBe('/settings/taxes?tab=tax-rules')
    expect(first('inclusive')?.href).toBe('/settings/taxes?tab=tax-rules#charging')
    expect(first('godown')?.href).toBe('/settings/locations')
  })

  it('sends store details, privacy, files and personal preferences to their new homes', () => {
    expect(first('store name')?.href).toBe('/settings/store#store-details')
    expect(first('cookie')?.href).toBe('/settings/privacy#banner')
    expect(first('data request')?.href).toBe('/settings/privacy/requests')
    expect(first('r2')?.href).toBe('/content/files/storage')
    expect(first('dark mode')?.href).toBe('/settings/appearance')
    expect(first('hindi')?.href).toBe('/account/language')
    expect(first('sender')?.href).toBe('/settings/notifications#notifications-sender')
  })

  it('never points at an address that is now a redirect', () => {
    const oldPaths = SETTINGS_REDIRECTS.map((r) => r.source.replace('/:path*', ''))
    const under = (href: string, old: string) =>
      href === old || ['/', '?', '#'].some((sep) => href.startsWith(`${old}${sep}`))
    const stale = SETTINGS_SEARCH_INDEX.filter((e) => oldPaths.some((old) => under(e.href, old)))
    expect(stale).toEqual([])
  })

  it('finds Policies and Checkout', () => {
    expect(first('refund policy')?.href).toBe('/settings/policies')
    expect(first('grievance')?.href).toBe('/settings/policies#grievance')
    expect(first('minimum order')?.href).toBe('/settings/checkout#minimum')
    expect(first('block pincode')?.href).toBe('/settings/checkout#cod')
    expect(first('business buyer')?.href).toBe('/settings/checkout?tab=branding#gstin')
  })

  it('offers both Shipping and Apps for "courier"', () => {
    const hrefs = searchSettings(SETTINGS_SEARCH_INDEX, 'courier').map((e) => e.href)
    expect(hrefs).toContain('/settings/shipping#courier')
    expect(hrefs).toContain('/apps')
  })

  it('matches multi-word phrases and requires every word', () => {
    expect(first('cash on delivery')?.title).toBe('Cash on delivery (COD)')
    expect(searchSettings(SETTINGS_SEARCH_INDEX, 'upi zzz')).toEqual([])
  })

  it('returns nothing for an empty query', () => {
    expect(searchSettings(SETTINGS_SEARCH_INDEX, '   ')).toEqual([])
  })
})
