import { describe, expect, it } from 'vitest'
import { SETTINGS_SEARCH_INDEX } from '@/data/settings-search'
import { searchSettings } from './settings-search'

const first = (q: string) => searchSettings(SETTINGS_SEARCH_INDEX, q)[0]

describe('searchSettings', () => {
  it('finds pages by the short forms shop owners type', () => {
    expect(first('UPI')?.href).toBe('/settings/payments')
    expect(first('cod')?.href).toBe('/settings/payments')
    expect(first('GST')?.href).toBe('/settings/general#tax')
    expect(first('whatsapp')?.where).toBe('Notifications')
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
