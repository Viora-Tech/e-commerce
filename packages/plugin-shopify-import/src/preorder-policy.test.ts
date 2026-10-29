import { describe, expect, it } from 'vitest'
import { parseProductsCsv } from './csv-products'
import { applyPreorderCampaigns, preorderCampaignsFromHtml } from './preorder-campaigns'
import { mapVariant } from './shopify-api'
import type { NProduct, NVariant } from './types'
import { preorderAllowedFrom, preorderFrom } from './write-products'

const gVariant = (inventoryPolicy: 'DENY' | 'CONTINUE' | null, tracked = true) => ({
  id: 'gid://shopify/ProductVariant/1',
  title: 'Marble',
  sku: null,
  barcode: null,
  price: '8999.00',
  compareAtPrice: null,
  taxable: true,
  inventoryQuantity: 0,
  inventoryPolicy,
  selectedOptions: [{ name: 'Colour', value: 'Marble' }],
  image: null,
  inventoryItem: { tracked, harmonizedSystemCode: null, unitCost: null, measurement: null },
})

const v = (sellsOutOfStock: boolean | undefined, trackInventory = true) =>
  ({ sellsOutOfStock, trackInventory }) as NVariant

describe('pre-order from Shopify', () => {
  it('reads "Continue selling when out of stock" off the Admin API variant', () => {
    expect(mapVariant(gVariant('CONTINUE'), ['Colour'], null).sellsOutOfStock).toBe(true)
    expect(mapVariant(gVariant('DENY'), ['Colour'], null).sellsOutOfStock).toBe(false)
  })

  it('turns pre-order on when a tracked variant sells past zero', () => {
    expect(preorderFrom([v(false), v(true)])).toBe(true)
    expect(preorderFrom([v(false), v(false)])).toBe(false)
    // Shopify ignores the policy on an untracked variant: it never runs out.
    expect(preorderFrom([v(true, false)])).toBe(false)
    // Nothing said (a CSV without the column): the product is left as it is.
    expect(preorderFrom([v(undefined)])).toBeUndefined()
  })

  it('reads the CSV inventory policy column', () => {
    const csv = [
      'Handle,Title,Option1 Name,Option1 Value,Variant Price,Variant Inventory Policy',
      'flow-lite84,Lofree Flow Lite84,Colour,Marble,8999,continue',
      'flow-lite84,,Colour,White,8999,deny',
      'x2h,X2H,Title,Default Title,6499,',
    ].join('\n')
    const { products } = parseProductsCsv(csv)
    expect(products.map((p) => [p.handle, preorderFrom(p.variants)])).toEqual([
      ['flow-lite84', true],
      ['x2h', false],
    ])
    const noColumn = parseProductsCsv('Handle,Title,Variant Price\nx2h,X2H,6499')
    expect(preorderFrom(noColumn.products[0]?.variants ?? [])).toBeUndefined()
  })
})

describe('pre-order per variant from Shopify (#962)', () => {
  it('maps each variant\'s inventory policy to its "Allow pre-order"', () => {
    const variants = [v(true), v(false), v(false, false)]
    expect(variants.map((x) => preorderAllowedFrom(variants, x))).toEqual([true, false, true])
    // Not a pre-order product by its policies: the variants are left as they are.
    const plain = [v(false), v(false)]
    expect(plain.map((x) => preorderAllowedFrom(plain, x))).toEqual([undefined, undefined])
  })
})

/** The attribute Essential Pre-Order's app embed writes into every storefront page. */
const appData = (campaigns: unknown[]) =>
  `<div id="preorder" preorder-app-data="${JSON.stringify({ preorderCampaigns: campaigns })
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')}"></div>`

const MESSAGE =
  'This Product is on Pre-Order and will arrive around the end of November 2026. NOTE: Pre-orders cannot be cancelled and are non-refundable.'

describe('Essential Pre-Order campaigns (#936, #962)', () => {
  const html = appData([
    {
      content: { message: MESSAGE, buttonText: 'Preorder' },
      placement: { specificProducts: [57615735685286, 57615684108454] },
    },
    { content: { message: 'Other & later' }, placement: { specificProducts: [111] } },
    { content: { message: 'No placement' }, placement: {} },
  ])

  it('reads every campaign variant and its message off the page', () => {
    const campaigns = preorderCampaignsFromHtml(html)
    expect([...campaigns]).toEqual([
      ['57615735685286', MESSAGE],
      ['57615684108454', MESSAGE],
      ['111', 'Other & later'],
    ])
    expect(preorderCampaignsFromHtml('<html></html>').size).toBe(0)
    expect(preorderCampaignsFromHtml('<div preorder-app-data="{broken"></div>').size).toBe(0)
  })

  it('puts campaign variants on pre-order and gives the product its message as the note', () => {
    const gid = (n: number) => `gid://shopify/ProductVariant/${n}`
    const product = {
      variants: [
        { sourceId: gid(57615735685286), sellsOutOfStock: false, trackInventory: true },
        // X1 SE: not in the campaign, stops at zero.
        { sourceId: gid(57615736144038), sellsOutOfStock: false, trackInventory: true },
      ],
    } as NProduct
    applyPreorderCampaigns(product, preorderCampaignsFromHtml(html))
    expect(product.preorderNote).toBe(MESSAGE)
    expect(product.variants.map((x) => preorderAllowedFrom(product.variants, x))).toEqual([
      true,
      false,
    ])
    const untouched = { variants: [{ sourceId: gid(5), sellsOutOfStock: false }] } as NProduct
    applyPreorderCampaigns(untouched, preorderCampaignsFromHtml(html))
    expect(untouched.preorderNote).toBeUndefined()
    expect(untouched.variants[0]?.sellsOutOfStock).toBe(false)
  })
})
