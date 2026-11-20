import { numericId } from '@commerce/core/theme-import'
import { describe, expect, it } from 'vitest'
import type { FeedProduct } from '../shopify-json/shape'
import { CSV_COLUMNS, csvCell, feedCsv, feedRows, feedXml, xmlText } from './shape'

const PRODUCT_ID = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7b'
const VARIANT_A = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7c'
const VARIANT_B = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7d'
const SINGLE = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a80'
const SINGLE_VARIANT = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a81'
const IMAGE = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7e'

const variant = {
  inventoryQuantity: 9,
  barcode: null,
  weightGrams: null,
}

const pad: FeedProduct = {
  id: PRODUCT_ID,
  handle: 'glass-pad',
  title: 'Glass Pad',
  descriptionHtml: '<p>Smooth</p>',
  vendor: 'Example Brand',
  type: 'Mousepad',
  tags: [],
  images: [{ id: IMAGE, url: 'https://cdn.example/pad.webp', alt: 'Black' }],
  variants: [
    {
      ...variant,
      id: VARIANT_A,
      title: 'Small',
      price: 89900,
      compareAtPrice: 129900,
      available: false,
      inventoryQuantity: 0,
      sku: 'GP-S',
      options: ['Small'],
      image: { id: IMAGE, url: 'https://cdn.example/pad-small.webp' },
    },
    {
      ...variant,
      id: VARIANT_B,
      title: 'Large',
      price: 149905,
      compareAtPrice: 149905,
      available: true,
      sku: null,
      options: ['Large'],
      image: null,
    },
  ],
  options: [{ name: 'Size', values: ['Small', 'Large'] }],
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-11-10T12:00:00Z'),
  preorder: false,
}

const skates: FeedProduct = {
  ...pad,
  id: SINGLE,
  handle: 'mouse skates',
  title: 'Skates, "fast" & <smooth>',
  vendor: '  ',
  images: [{ id: IMAGE, url: '/media/skates.webp' }],
  variants: [
    {
      ...variant,
      id: SINGLE_VARIANT,
      title: 'Default Title',
      price: 49900,
      compareAtPrice: null,
      available: true,
      sku: '=HYPERLINK("x")',
      options: [],
      image: null,
    },
  ],
}

const ctx = { origin: 'https://www.waimers.in', storeName: 'Waimers' }

describe('feedRows', () => {
  const rows = feedRows([pad, skates], ctx)

  it('writes one row per variant with the columns feeds ask for', () => {
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      id: String(numericId(VARIANT_A)),
      groupId: String(numericId(PRODUCT_ID)),
      name: 'Glass Pad - Small',
      price: '899.00',
      comparePrice: '1299.00',
      availability: 'out_of_stock',
      link: `https://www.waimers.in/products/glass-pad?variant=${numericId(VARIANT_A)}`,
      image: 'https://cdn.example/pad-small.webp',
      brand: 'Example Brand',
      sku: 'GP-S',
    })
  })

  it('says in or out of stock, never a count', () => {
    expect(rows.map((r) => r.availability)).toEqual(['out_of_stock', 'in_stock', 'in_stock'])
    expect(JSON.stringify(rows)).not.toContain('inventory')
  })

  it('falls back to the product image, and drops a compare price that is not higher', () => {
    expect(rows[1]?.image).toBe('https://cdn.example/pad.webp')
    expect(rows[1]?.comparePrice).toBeNull()
    expect(rows[1]?.sku).toBe('')
  })

  it("names a one-variant product by itself, links it plainly, and uses the store's name as brand", () => {
    expect(rows[2]).toMatchObject({
      name: 'Skates, "fast" & <smooth>',
      link: 'https://www.waimers.in/products/mouse%20skates',
      image: 'https://www.waimers.in/media/skates.webp',
      brand: 'Waimers',
    })
  })
})

describe('feedXml', () => {
  const xml = feedXml(feedRows([pad, skates], ctx), {
    title: 'Waimers',
    link: ctx.origin,
    description: 'Products from Waimers',
  })

  it("is Google Merchant RSS with Google's fields", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">')
    expect(xml).toContain('<g:availability>out_of_stock</g:availability>')
    expect(xml).toContain(`<g:item_group_id>${numericId(PRODUCT_ID)}</g:item_group_id>`)
  })

  it('writes a compare price as price and the selling price as sale_price', () => {
    expect(xml).toContain('<g:price>1299.00 INR</g:price><g:sale_price>899.00 INR</g:sale_price>')
    expect(xml).toContain('<g:price>1499.05 INR</g:price><g:availability>')
  })

  it('escapes text', () => {
    expect(xml).toContain('<title>Skates, &quot;fast&quot; &amp; &lt;smooth&gt;</title>')
    expect(xmlText('a\u0001b')).toBe('ab')
  })
})

describe('feedCsv', () => {
  const csv = feedCsv(feedRows([pad, skates], ctx))
  const lines = csv.trimEnd().split('\r\n')

  it('has a header row and one line per variant', () => {
    expect(lines[0]).toBe(CSV_COLUMNS.join(','))
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe(
      `${numericId(VARIANT_A)},Glass Pad - Small,899.00,1299.00,out_of_stock,https://www.waimers.in/products/glass-pad?variant=${numericId(VARIANT_A)},https://cdn.example/pad-small.webp,Example Brand,GP-S`,
    )
  })

  it('quotes commas and quotes, and keeps spreadsheet formulas from running', () => {
    expect(lines[3]).toContain('"Skates, ""fast"" & <smooth>"')
    expect(lines[3]?.endsWith(`,Waimers,"'=HYPERLINK(""x"")"`)).toBe(true)
    expect(csvCell('-5')).toBe("'-5")
    expect(csvCell('-5', false)).toBe('-5')
  })
})
