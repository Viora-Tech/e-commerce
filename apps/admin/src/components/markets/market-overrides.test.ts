import type { MarketView } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { adjustmentText, marketOverrides } from './market-overrides'

const market = (fields: Partial<MarketView>): MarketView => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'India',
  handle: 'india',
  isPrimary: false,
  enabled: true,
  currency: 'INR',
  locale: 'en',
  locales: [],
  subfolder: null,
  catalogId: null,
  storeDomainId: null,
  priceAdjustmentBp: 0,
  rounding: 'none',
  manualRate: null,
  duties: 'dap',
  countries: [],
  hostname: null,
  ...fields,
})

const india = market({ isPrimary: true, countries: ['IN'] })
const NAMES: Record<string, string> = { en: 'English', ar: 'Arabic' }
const ctx = {
  primaryHost: 'waimers.koomerce.app',
  catalogName: (id: string) => (id === 'c1' ? 'Gulf catalog' : null),
  languageName: (code: string) => NAMES[code] ?? code,
}

describe('marketOverrides', () => {
  it('lists nothing for a market that keeps every default', () => {
    expect(marketOverrides(market({ countries: ['NP'] }), india, ctx)).toEqual([])
  })

  it('lists currency, catalog, domain, languages and adjustment in order', () => {
    const gulf = market({
      currency: 'AED',
      catalogId: 'c1',
      subfolder: 'ae',
      locale: 'ar',
      locales: ['en'],
      priceAdjustmentBp: 1_000,
    })
    expect(marketOverrides(gulf, india, ctx)).toEqual([
      { key: 'currency', value: 'AED' },
      { key: 'catalog', value: 'Gulf catalog' },
      { key: 'domain', value: 'waimers.koomerce.app/ae' },
      { key: 'languages', value: 'Arabic, English' },
      { key: 'adjustment', value: '+10%' },
    ])
  })

  it('shows its own domain, and skips a catalog it cannot name', () => {
    const uk = market({ hostname: 'waimers.co.uk', catalogId: 'gone' })
    expect(marketOverrides(uk, india, ctx)).toEqual([{ key: 'domain', value: 'waimers.co.uk' }])
  })
})

describe('adjustmentText', () => {
  it('signs the percent', () => {
    expect(adjustmentText(1_000)).toBe('+10%')
    expect(adjustmentText(-250)).toBe('−2.5%')
  })
})
