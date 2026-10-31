import {
  buildThemeBundle,
  createPageContext,
  type LiquidCustomerData,
  type LiquidDataSource,
  renderLiquidSection,
} from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { type CachedLiquid, keepable, newTrace, servable, traceContextReads } from './liquid-cache'

/**
 * The render cache as `liquid-theme.ts` uses it, over the real engine: a shopper's name or email
 * never reaches another shopper, and a signed-out render is never served to a signed-in one.
 */

const shopper = (name: string, email: string): LiquidCustomerData => ({
  id: `0192f0a1-2b3c-7d4e-8f00-${email.length.toString().padStart(12, '0')}`,
  email,
  name,
  phone: null,
  acceptsMarketing: false,
  tags: [],
  ordersCount: 1,
  totalSpent: 10000,
  defaultAddress: null,
  addressesCount: 0,
})

const ASHA = shopper('Asha Verma', 'asha@example.test')
const RAVI = shopper('Ravi Kumar', 'ravi@example.test')

function dataSource(customer: LiquidCustomerData | null): LiquidDataSource {
  const none = async () => null
  const empty = async () => []
  const custom = async () => ({ metafields: {}, entries: [] })
  return {
    shop: {
      name: 'Waimers',
      email: 'hi@example.test',
      phone: '',
      domain: 'shop.example',
      url: 'https://shop.example',
      currency: 'INR',
      description: '',
      policies: [],
    },
    product: none,
    collection: none,
    collectionProducts: empty,
    relatedProducts: empty,
    collections: empty,
    menu: none,
    blog: none,
    page: none,
    cart: async () => ({ itemCount: 0, totalPrice: 0, items: [] }),
    customer: async () => customer,
    metafields: custom,
    metaobjectsOfType: custom,
    metaobjects: custom,
  }
}

const bundle = buildThemeBundle({
  themeId: 'customer-cache',
  version: 'v1',
  textFiles: new Map([
    [
      'sections/account.liquid',
      '{%- if customer -%}Hi {{ customer.first_name }} ({{ customer.email }}){%- else -%}Sign in to see your orders{%- endif -%}',
    ],
    ['sections/banner.liquid', '<p>{{ shop.name }}</p>'],
  ]),
  assetChecksums: new Map(),
  settings: {},
})

/** One request for `section`: from the cache when servable, else rendered (and kept if keepable). */
async function request(
  cache: Map<string, CachedLiquid>,
  section: string,
  customer: LiquidCustomerData | null,
) {
  const hit = cache.get(section)
  const signedOut = async () => customer === null
  if (hit && (await servable(hit, async () => true, signedOut)))
    return { html: hit.html, hit: true }
  const ctx = await createPageContext({
    bundle,
    data: dataSource(customer),
    request: {
      template: 'page',
      path: '/pages/tracking',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: '',
    },
    assetBase: '/theme-assets/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  const trace = newTrace()
  traceContextReads(ctx, () => trace)
  const html = (
    await renderLiquidSection(
      ctx,
      { id: section, type: section, settings: {}, blocks: [], location: 'template', index: 0 },
      (err) => {
        throw err
      },
    )
  ).trim()
  if (keepable(trace, true, customer !== null)) {
    cache.set(section, { html, cart: trace.cart, customer: trace.customer })
  }
  return { html, hit: false }
}

describe('caching renders that read the customer', () => {
  it('never keeps a signed-in shopper’s render, so it never reaches anyone else', async () => {
    const cache = new Map<string, CachedLiquid>()
    const asha = await request(cache, 'account', ASHA)
    expect(asha.html).toBe('Hi Asha (asha@example.test)')
    expect(cache.size).toBe(0)

    const ravi = await request(cache, 'account', RAVI)
    expect(ravi).toEqual({ html: 'Hi Ravi (ravi@example.test)', hit: false })
    const guest = await request(cache, 'account', null)
    expect(guest.html).toBe('Sign in to see your orders')
    for (const html of [ravi.html, guest.html]) {
      expect(html).not.toContain('Asha')
      expect(html).not.toContain('asha@example.test')
    }
  })

  it('serves a signed-out render to signed-out shoppers only', async () => {
    const cache = new Map<string, CachedLiquid>()
    await request(cache, 'account', null)
    expect(cache.get('account')).toMatchObject({ customer: true })
    expect(await request(cache, 'account', null)).toEqual({
      html: 'Sign in to see your orders',
      hit: true,
    })
    expect(await request(cache, 'account', ASHA)).toEqual({
      html: 'Hi Asha (asha@example.test)',
      hit: false,
    })
    // Asha's render did not replace the shared one.
    expect(cache.get('account')?.html).toBe('Sign in to see your orders')
  })

  it('shares a render that never read the customer with everyone', async () => {
    const cache = new Map<string, CachedLiquid>()
    expect(await request(cache, 'banner', ASHA)).toEqual({ html: '<p>Waimers</p>', hit: false })
    expect(cache.get('banner')).toMatchObject({ customer: false })
    expect(await request(cache, 'banner', RAVI)).toEqual({ html: '<p>Waimers</p>', hit: true })
    expect(await request(cache, 'banner', null)).toEqual({ html: '<p>Waimers</p>', hit: true })
  })
})
