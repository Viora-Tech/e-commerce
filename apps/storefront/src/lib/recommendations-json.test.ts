import type { LiquidProductData } from '@commerce/core'
import { numericId } from '@commerce/core/theme-import'
import { describe, expect, it } from 'vitest'
import { recommendationsJson, recommendationsParams, validSectionId } from './recommendations-json'

const PRODUCT_ID = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7b'
const VARIANT_A = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7c'
const VARIANT_B = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7d'

const pad: LiquidProductData = {
  id: PRODUCT_ID,
  handle: 'glass-pad',
  title: 'Glass Pad',
  descriptionHtml: '<p>Smooth</p>',
  vendor: 'Waimers',
  type: 'Mousepad',
  tags: ['glass'],
  images: [{ url: 'https://cdn.example/pad.webp', alt: null, width: 800, height: 800 }],
  variants: [
    {
      id: VARIANT_A,
      title: 'Small',
      price: 89900,
      compareAtPrice: 129900,
      available: false,
      inventoryQuantity: 0,
      sku: 'GP-S',
      barcode: null,
      options: ['Small'],
      image: null,
      weightGrams: 300,
    },
    {
      id: VARIANT_B,
      title: 'Large',
      price: 149900,
      compareAtPrice: null,
      available: true,
      inventoryQuantity: 4,
      sku: null,
      barcode: null,
      options: ['Large'],
      image: null,
      weightGrams: null,
    },
  ],
  options: [{ name: 'Size', values: ['Small', 'Large'] }],
  createdAt: new Date('2026-10-01T00:00:00Z'),
  preorder: false,
}

describe('recommendationsParams', () => {
  it("reads the params a theme's recommendations script sends", () => {
    const glide =
      'product_id=7712345678&limit=4&section_id=template--123__related-products&intent=related'
    expect(recommendationsParams(new URLSearchParams(glide))).toEqual({
      productId: '7712345678',
      limit: 4,
      intent: 'related',
      sectionId: 'template--123__related-products',
    })
  })

  it("falls back to Shopify's defaults and caps the limit at 10", () => {
    expect(recommendationsParams(new URLSearchParams('product_id=1&limit=50'))).toMatchObject({
      limit: 10,
      intent: 'related',
      sectionId: '',
    })
    expect(recommendationsParams(new URLSearchParams('product_id=1&limit=-3'))).toMatchObject({
      limit: 10,
    })
    expect(
      recommendationsParams(new URLSearchParams('product_id=1&intent=complementary')),
    ).toMatchObject({ intent: 'complementary' })
    expect(recommendationsParams(new URLSearchParams('product_id=1&intent=junk'))).toMatchObject({
      intent: 'related',
    })
  })

  it('accepts only plain section ids', () => {
    expect(validSectionId('template--123__related-products')).toBe(true)
    expect(validSectionId('../x')).toBe(false)
    expect(validSectionId('')).toBe(false)
  })
})

describe('recommendationsJson', () => {
  it("writes products in Shopify's product.js shape, prices in paise", () => {
    const out = recommendationsJson([pad], 'related')
    expect(out.intent).toBe('related')
    const [p] = out.products
    expect(p).toMatchObject({
      id: numericId(PRODUCT_ID),
      handle: 'glass-pad',
      title: 'Glass Pad',
      url: '/products/glass-pad',
      vendor: 'Waimers',
      type: 'Mousepad',
      available: true,
      // The first buyable variant's price, as Shopify's `price`.
      price: 149900,
      price_min: 89900,
      price_max: 149900,
      price_varies: true,
      compare_at_price_max: 129900,
      featured_image: 'https://cdn.example/pad.webp',
      images: ['https://cdn.example/pad.webp'],
      options: [{ name: 'Size', position: 1, values: ['Small', 'Large'] }],
    })
    expect(typeof p?.id).toBe('number')
    expect(p?.variants.map((v) => [v.id, v.price, v.available, v.option1])).toEqual([
      [numericId(VARIANT_A), 89900, false, 'Small'],
      [numericId(VARIANT_B), 149900, true, 'Large'],
    ])
    expect(p?.variants[0]?.name).toBe('Glass Pad - Small')
  })

  it('answers an empty row as an empty list', () => {
    expect(recommendationsJson([], 'complementary')).toEqual({
      intent: 'complementary',
      products: [],
    })
  })
})
