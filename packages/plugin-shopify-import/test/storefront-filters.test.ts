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

describe('storefront metafield filters', () => {
  it('reads every metafield filter a collection page names, once each', () => {
    expect([...filterKeysFromHtml(PAGE)]).toEqual([
      'custom.filter_grip',
      'custom.spec-switches',
      'my_fields.hand_size',
    ])
  })

  it("reads them from the store's /collections/all", async () => {
    const urls: string[] = []
    const keys = await storefrontFilterKeys(
      client(async (url) => {
        urls.push(String(url))
        return new Response(PAGE, { status: 200 })
      }),
    )
    expect(urls).toEqual(['https://waimers.myshopify.com/collections/all'])
    expect(keys.has('custom.filter_grip')).toBe(true)
  })

  it('gives none when the storefront is locked or down', async () => {
    expect(
      (await storefrontFilterKeys(client(async () => new Response('', { status: 401 })))).size,
    ).toBe(0)
    const down = client(async () => {
      throw new Error('offline')
    })
    expect((await storefrontFilterKeys(down)).size).toBe(0)
  })
})
