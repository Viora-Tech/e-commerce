import type { StoreMarketRoute } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { liquidMarketFor } from './liquid-market'
import {
  fallbackMarket,
  marketHeaders,
  marketPath,
  marketRedirect,
  pickMarket,
  switchMarket,
  withoutMarketSegment,
} from './markets'

const PRIMARY = 'waimers.koomerce.app'

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
const gulf = market({
  id: 'gulf',
  currency: 'AED',
  locales: ['ar'],
  subfolder: 'ae',
  countries: ['AE', 'OM', 'QA'],
})
const usa = market({ id: 'usa', hostname: 'waimers.com', locales: ['es'], countries: ['US'] })
const canada = market({ id: 'ca', subfolder: 'en-ca', locales: ['fr'], countries: ['CA'] })
const uk = market({ id: 'uk', subfolder: 'gb', countries: ['GB'], enabled: false })
// No subfolder, no domain: reached only through the shopper's choice.
const europe = market({ id: 'eu', currency: 'EUR', countries: ['FR', 'DE'] })
const markets = [india, gulf, usa, canada, uk, europe]

type PickInput = Parameters<typeof pickMarket>[0]
const pick = (pathname: string, extra: Partial<PickInput> = {}) =>
  pickMarket({
    markets,
    hostname: PRIMARY,
    primaryHostname: PRIMARY,
    pathname,
    cookie: null,
    ...extra,
  })

describe('pickMarket', () => {
  it('serves the primary market with no prefix, domain or choice', () => {
    expect(pick('/products/pad')).toMatchObject({
      market: { id: 'in' },
      locale: 'en',
      country: 'IN',
      via: 'primary',
      prefix: '',
      pathname: '/products/pad',
      root: { hostname: null, prefix: '' },
    })
  })

  it('reads a subfolder and takes it off the path', () => {
    expect(pick('/ae/products/pad')).toMatchObject({
      market: { id: 'gulf' },
      locale: 'en',
      country: 'AE',
      via: 'prefix',
      prefix: '/ae',
      pathname: '/products/pad',
      root: { hostname: null, prefix: '/ae' },
    })
    expect(pick('/ae').pathname).toBe('/')
    expect(pick('/ae/').pathname).toBe('/')
  })

  it('takes the language from a language-and-place prefix', () => {
    expect(pick('/ar-ae/collections/mice')).toMatchObject({
      market: { id: 'gulf' },
      locale: 'ar',
      pathname: '/collections/mice',
      root: { prefix: '/ar-ae' },
    })
    expect(pick('/fr-ca/cart')).toMatchObject({ market: { id: 'ca' }, locale: 'fr' })
    expect(pick('/en-ca/cart')).toMatchObject({ market: { id: 'ca' }, locale: 'en' })
    expect(pick('/hi/products/pad')).toMatchObject({
      market: { id: 'in' },
      locale: 'hi',
      pathname: '/products/pad',
      root: { prefix: '/hi' },
    })
  })

  it('never reads a language the market lacks, a disabled market or a route as a prefix', () => {
    expect(pick('/fr-ae/x')).toMatchObject({ market: { id: 'in' }, pathname: '/fr-ae/x' })
    expect(pick('/gb/products/pad')).toMatchObject({ market: { id: 'in' }, prefix: '' })
    expect(pick('/c/token').pathname).toBe('/c/token')
    expect(pick('/products').pathname).toBe('/products')
  })

  it("serves a market's own domain, with its languages as prefixes there", () => {
    const onUsa = { hostname: 'waimers.com' }
    expect(pick('/', onUsa)).toMatchObject({ market: { id: 'usa' }, via: 'domain' })
    expect(pick('/es/products/x', onUsa)).toMatchObject({
      market: { id: 'usa' },
      locale: 'es',
      pathname: '/products/x',
    })
    expect(pick('/hi/x', onUsa)).toMatchObject({ market: { id: 'usa' }, pathname: '/hi/x' })
    // A subfolder market belongs to the primary domain.
    expect(pick('/ae/x', onUsa).root).toEqual({ hostname: PRIMARY, prefix: '/ae' })
  })

  it("follows the shopper's saved country and language", () => {
    expect(pick('/cart', { cookie: 'OM' })).toMatchObject({
      market: { id: 'gulf' },
      country: 'OM',
      via: 'cookie',
      root: { hostname: null, prefix: '/ae' },
    })
    expect(pick('/cart', { cookie: 'IN:hi' })).toMatchObject({
      locale: 'hi',
      root: { prefix: '/hi' },
    })
    expect(pick('/cart', { cookie: 'FR' })).toMatchObject({
      market: { id: 'eu' },
      root: { hostname: null, prefix: '' },
    })
    expect(pick('/cart', { cookie: 'US' }).root).toEqual({ hostname: 'waimers.com', prefix: '' })
    // A prefix beats the saved choice; a disabled market's or a garbled choice is ignored.
    expect(pick('/en-ca/cart', { cookie: 'OM' }).market.id).toBe('ca')
    expect(pick('/cart', { cookie: 'GB' }).market.id).toBe('in')
    expect(pick('/cart', { cookie: 'om;x' }).via).toBe('primary')
  })

  it('serves India while the store has no market rows', () => {
    const p = pickMarket({
      markets: [],
      hostname: PRIMARY,
      primaryHostname: PRIMARY,
      pathname: '/ae/x',
      cookie: 'AE',
    })
    expect(p).toMatchObject({ market: { id: '', currency: 'INR' }, pathname: '/ae/x' })
  })
})

describe('marketRedirect', () => {
  it("sends a browse page to the saved market's own URL", () => {
    expect(marketRedirect(pick('/products/pad', { cookie: 'OM' }), '?v=1')).toBe(
      '/ae/products/pad?v=1',
    )
    expect(marketRedirect(pick('/', { cookie: 'OM' }), '')).toBe('/ae')
    expect(marketRedirect(pick('/products/x', { cookie: 'US' }), '')).toBe(
      'https://waimers.com/products/x',
    )
  })

  it('writes every prefix one way', () => {
    expect(marketRedirect(pick('/AE/products/x'), '')).toBe('/ae/products/x')
    expect(marketRedirect(pick('/en-ae/products/x'), '')).toBe('/ae/products/x')
    expect(marketRedirect(pick('/ae/products/x', { hostname: 'waimers.com' }), '')).toBe(
      `https://${PRIMARY}/ae/products/x`,
    )
  })

  it('leaves checkout, pages already in place and cookie-only markets alone', () => {
    expect(marketRedirect(pick('/checkout', { cookie: 'OM' }), '')).toBeNull()
    expect(marketRedirect(pick('/ae/cart', { cookie: 'OM' }), '')).toBeNull()
    expect(marketRedirect(pick('/cart'), '')).toBeNull()
    expect(marketRedirect(pick('/products/x', { cookie: 'FR' }), '')).toBeNull()
    expect(marketRedirect(pick('/', { hostname: 'waimers.com' }), '')).toBeNull()
  })
})

describe('switchMarket', () => {
  const choose = (returnTo: string, country: string, language = '', extra = {}) =>
    switchMarket({
      markets,
      hostname: PRIMARY,
      primaryHostname: PRIMARY,
      returnTo,
      cookie: null,
      country,
      language,
      ...extra,
    })

  it('goes back to the same page in the chosen market', () => {
    expect(choose('/products/pad', 'OM')).toEqual({ location: '/ae/products/pad', saved: 'OM' })
    expect(choose('/ae/products/pad', 'IN')).toEqual({ location: '/products/pad', saved: 'IN' })
    expect(choose('/', 'AE')).toEqual({ location: '/ae', saved: 'AE' })
    expect(choose('/', 'US')).toEqual({ location: 'https://waimers.com/', saved: 'US' })
    expect(choose('/', 'IN', '', { hostname: 'waimers.com' })).toEqual({
      location: `https://${PRIMARY}/`,
      saved: 'IN',
    })
  })

  it('switches the language and keeps the query', () => {
    expect(choose('/ae/products/pad?variant=1', '', 'ar')).toEqual({
      location: '/ar-ae/products/pad?variant=1',
      saved: 'AE:ar',
    })
    expect(choose('/products/pad', '', 'hi')).toEqual({
      location: '/hi/products/pad',
      saved: 'IN:hi',
    })
    // Not offered: the market keeps its language.
    expect(choose('/ar-ae/x', '', 'de').location).toBe('/ar-ae/x')
  })

  it('keeps the market for a country no market sells to', () => {
    expect(choose('/ae/x', 'ZZ')).toEqual({ location: '/ae/x', saved: 'AE' })
  })

  it('never leaves the site', () => {
    expect(choose('//evil.test/x', 'IN').location).toBe('/')
    expect(choose('https://evil.test/x', 'IN').location).toBe('/')
    expect(choose('/\\evil.test', 'IN').location).toBe('/')
  })
})

describe('marketHeaders → liquidMarketFor', () => {
  const sent = (path: string, extra: Partial<PickInput> = {}) =>
    new Headers(marketHeaders(pick(path, extra), markets, extra.hostname ?? PRIMARY, PRIMARY))

  it("hands an imported theme the market, its languages' roots and every country", () => {
    const h = sent('/ar-ae/products/x', { cookie: 'OM' })
    expect(Object.fromEntries(h)).toEqual({
      'x-market-id': 'gulf',
      'x-market-currency': 'AED',
      'x-market-locale': 'ar',
      'x-market-country': 'OM',
      'x-market-prefix': '/ar-ae',
      'x-market-countries': 'IN,AE,OM,QA,US,CA,FR,DE',
      'x-market-country-currencies': 'IN:INR,AE:AED,OM:AED,QA:AED,US:USD,CA:USD,FR:EUR,DE:EUR',
      'x-market-languages': 'en=/ae,ar=/ar-ae',
    })
    expect(liquidMarketFor(h)).toEqual({
      market: {
        id: 'gulf',
        handle: '',
        locale: 'ar',
        languages: [
          { code: 'en', rootUrl: '/ae' },
          { code: 'ar', rootUrl: '/ar-ae' },
        ],
        country: 'OM',
        countries: ['IN', 'AE', 'OM', 'QA', 'US', 'CA', 'FR', 'DE'],
        currencies: {
          IN: 'INR',
          AE: 'AED',
          OM: 'AED',
          QA: 'AED',
          US: 'USD',
          CA: 'USD',
          FR: 'EUR',
          DE: 'EUR',
        },
        prefix: '/ar-ae',
      },
      key: 'gulf:ar:OM:/ar-ae',
    })
    expect(sent('/', { hostname: 'waimers.com' }).get('x-market-languages')).toBe('en=/,es=/es')
  })

  it('leaves a store selling in one country and one language as it was', () => {
    const solo = [fallbackMarket()].map((m) => ({ ...m, id: 'in' }))
    const h = new Headers(
      marketHeaders(
        pickMarket({
          markets: solo,
          hostname: PRIMARY,
          primaryHostname: PRIMARY,
          pathname: '/',
          cookie: null,
        }),
        solo,
        PRIMARY,
        PRIMARY,
      ),
    )
    expect(h.get('x-market-id')).toBe('in')
    expect(liquidMarketFor(h)).toEqual({ market: undefined, key: '' })
    expect(liquidMarketFor(new Headers())).toEqual({ market: undefined, key: '' })
  })
})

describe('marketPath / withoutMarketSegment', () => {
  it('prefixes own paths only', () => {
    expect(marketPath('/ae', '/products/x')).toBe('/ae/products/x')
    expect(marketPath('/ae', '/')).toBe('/ae')
    expect(marketPath('', '/cart')).toBe('/cart')
    expect(marketPath('/ae', 'https://x.test/a')).toBe('https://x.test/a')
    expect(marketPath('/ae', '//evil.test')).toBe('//evil.test')
  })

  it('drops a segment that could be any market prefix', () => {
    expect(withoutMarketSegment('/ae/checkout')).toBe('/checkout')
    expect(withoutMarketSegment('/en-us/checkout/pay')).toBe('/checkout/pay')
    expect(withoutMarketSegment('/checkout')).toBe('/checkout')
    expect(withoutMarketSegment('/c/x')).toBe('/c/x')
  })
})
