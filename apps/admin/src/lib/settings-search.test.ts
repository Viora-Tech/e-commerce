import { describe, expect, it } from 'vitest'
import { SETTINGS_SEARCH_INDEX } from '@/data/settings-search'
import { searchSettings } from './settings-search'

const first = (q: string) => searchSettings(SETTINGS_SEARCH_INDEX, q)[0]

describe('searchSettings', () => {
  it('finds pages by the short forms shop owners type', () => {
    expect(first('UPI')?.href).toBe('/settings/payments')
    expect(first('cod')?.href).toBe('/settings/payments')
    expect(first('GST')?.href).toBe('/settings/taxes')
    expect(first('invoice number')?.href).toBe('/settings/taxes#invoice-numbers')
    expect(first('irn')?.where).toBe('Taxes & GST')
    expect(first('whatsapp')?.where).toBe('Notifications')
  })

  it('finds Business and GST and Locations', () => {
    expect(first('PAN')?.href).toBe('/settings/business')
    expect(first('godown')?.href).toBe('/settings/locations')
  })

  it('finds Policies and Checkout', () => {
    expect(first('refund policy')?.href).toBe('/settings/policies')
    expect(first('grievance')?.href).toBe('/settings/policies#grievance')
    expect(first('minimum order')?.href).toBe('/settings/checkout#minimum')
    expect(first('block pincode')?.href).toBe('/settings/checkout#cod')
    expect(first('business buyer')?.href).toBe('/settings/checkout#gstin')
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
