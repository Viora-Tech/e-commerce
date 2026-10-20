import { describe, expect, it } from 'vitest'
import { ShopifyClient } from '../src/shopify-client'
import { filterKeysFromHtml, storefrontFilterKeys } from '../src/storefront-filters'

const PAGE = `
  <input type="checkbox" name="filter.p.m.custom.filter_grip" value="Claw">
  <input type="checkbox" name="filter.p.m.custom.filter_grip" value="Palm">
  <input name="filter.p.m.custom.spec-switches" value="Optical">
  <a href="/collections/all?filter.p.m.my_fields.hand_size=Large">Large</a>
  <input name="filter.v.price.gte"><input name="filter.p.vendor" value="Pulsar">`

const client = (fetch: typeof globalThis.fetch) =>
  new ShopifyClient({ shopDomain: 'waimers.myshopify.com', accessToken: 't', fetch })

/** Answers the Admin API with `primary` as the shop's primary domain, and pages with `page`. */
const shop =
  (primary: string | null, page: (url: string) => Response, urls: string[] = []) =>
  async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/admin/api/')) {
      const primaryDomain = primary ? { url: primary } : null
      return Response.json({ data: { shop: { primaryDomain } } })
    }
    urls.push(url)
    return page(url)
  }

describe('storefront metafield filters', () => {
  it('reads every metafield filter a collection page names, once each', () => {
    expect([...filterKeysFromHtml(PAGE)]).toEqual([
      'custom.filter_grip',
      'custom.spec-switches',
      'my_fields.hand_size',
    ])
  })

  it("reads them from /collections/all on the store's primary domain", async () => {
    const urls: string[] = []
    const keys = await storefrontFilterKeys(
      client(shop('https://waimers.in', () => new Response(PAGE), urls)),
    )
    expect(urls).toEqual(['https://waimers.in/collections/all'])
    expect(keys.has('custom.filter_grip')).toBe(true)
  })

  it('falls back to the myshopify address when the primary domain gives none', async () => {
    const urls: string[] = []
    const keys = await storefrontFilterKeys(
      client(
        shop(
          'https://waimers.in/',
          (url) => new Response(url.includes('myshopify') ? PAGE : '', { status: 200 }),
          urls,
        ),
      ),
    )
    expect(urls).toEqual([
      'https://waimers.in/collections/all',
      'https://waimers.myshopify.com/collections/all',
    ])
    expect(keys.size).toBe(3)
  })

  it('uses the myshopify address alone when the store has no primary domain', async () => {
    const urls: string[] = []
    await storefrontFilterKeys(client(shop(null, () => new Response(PAGE), urls)))
    expect(urls).toEqual(['https://waimers.myshopify.com/collections/all'])
  })

  it('gives none when the storefront is locked or down', async () => {
    expect(
      (await storefrontFilterKeys(client(shop(null, () => new Response('', { status: 402 })))))
        .size,
    ).toBe(0)
    const down = client(async () => {
      throw new Error('offline')
    })
    expect((await storefrontFilterKeys(down)).size).toBe(0)
  })
})
