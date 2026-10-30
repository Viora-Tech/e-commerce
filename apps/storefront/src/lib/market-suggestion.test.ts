import type { StoreMarketRoute } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { isSuggestionFreePath, marketSuggestion } from './market-suggestion'
import { fallbackMarket } from './markets'

const PRIMARY = 'waimers.koomerce.app'
const BROWSER =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'

const market = (m: Partial<StoreMarketRoute> & Pick<StoreMarketRoute, 'id'>): StoreMarketRoute => ({
  handle: m.id,
  isPrimary: false,
  enabled: true,
  currency: 'USD',
  locale: 'en',
  locales: [],
  subfolder: null,
  hostname: null,
  countries: [],
  ...m,
})

const india = { ...fallbackMarket(), id: 'in', locales: ['hi'] }
const gulf = market({ id: 'gulf', currency: 'AED', subfolder: 'ae', countries: ['AE', 'OM'] })
const usa = market({ id: 'usa', hostname: 'waimers.com', countries: ['US'] })
const uk = market({ id: 'uk', currency: 'GBP', subfolder: 'gb', countries: ['GB'], enabled: false })
const markets = [india, gulf, usa, uk]

const ask = (over: Partial<Parameters<typeof marketSuggestion>[0]> = {}) =>
  marketSuggestion({
    markets,
    hostname: PRIMARY,
    primaryHostname: PRIMARY,
    pathname: '/products/tee',
    cookie: null,
    visitorCountry: 'AE',
    userAgent: BROWSER,
    ...over,
  })

describe('marketSuggestion', () => {
  it("suggests the visitor's market on the primary market's pages", () => {
    expect(ask()).toEqual({
      country: 'AE',
      currency: 'AED',
      current: { country: 'IN', currency: 'INR', language: 'en' },
    })
  })

  it('suggests the primary market to an Indian visitor on a subfolder market', () => {
    expect(ask({ pathname: '/ae/products/tee', visitorCountry: 'in' })).toEqual({
      country: 'IN',
      currency: 'INR',
      current: { country: 'AE', currency: 'AED', language: 'en' },
    })
  })

  it("suggests from a market's own domain", () => {
    expect(ask({ hostname: 'waimers.com', pathname: '/', visitorCountry: 'OM' })?.current).toEqual({
      country: 'US',
      currency: 'USD',
      language: 'en',
    })
  })

  it('stays quiet when the page already shows their market', () => {
    expect(ask({ pathname: '/ae', visitorCountry: 'OM' })).toBeNull()
    expect(ask({ visitorCountry: 'IN' })).toBeNull()
  })

  it('stays quiet once the shopper saved a choice', () => {
    expect(ask({ cookie: 'IN' })).toBeNull()
    expect(ask({ cookie: 'AE:ar' })).toBeNull()
  })

  it('stays quiet for countries no live market sells to', () => {
    expect(ask({ visitorCountry: 'FR' })).toBeNull()
    // The UK market is off.
    expect(ask({ visitorCountry: 'GB' })).toBeNull()
  })

  it('stays quiet without a country, for bots and with one market', () => {
    expect(ask({ visitorCountry: null })).toBeNull()
    expect(ask({ visitorCountry: 'XX1' })).toBeNull()
    expect(ask({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' })).toBeNull()
    expect(ask({ userAgent: null })).toBeNull()
    expect(ask({ markets: [india, uk] })).toBeNull()
  })

  it('never shows on checkout or the shopper account, in any market', () => {
    expect(ask({ pathname: '/checkout' })).toBeNull()
    expect(ask({ pathname: '/ae/account/orders' })).toBeNull()
  })
})

describe('isSuggestionFreePath', () => {
  it('matches checkout and account only, on their boundaries', () => {
    expect(isSuggestionFreePath('/checkout/thank-you')).toBe(true)
    expect(isSuggestionFreePath('/ae/account')).toBe(true)
    expect(isSuggestionFreePath('/accountant')).toBe(false)
    expect(isSuggestionFreePath('/products/checkout')).toBe(false)
  })
})
