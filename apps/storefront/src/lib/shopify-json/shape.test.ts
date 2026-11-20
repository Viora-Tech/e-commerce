import { numericId } from '@commerce/core/theme-import'
import { describe, expect, it } from 'vitest'
import { isShopifyJsonPath, shopifyJsonPath } from './paths'
import {
  collectionJson,
  type FeedProduct,
  feedPaging,
  listProduct,
  productDetail,
  rupees,
} from './shape'

const PRODUCT_ID = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7b'
const VARIANT_A = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7c'
const VARIANT_B = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7d'
const IMAGE = '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7e'

const pad: FeedProduct = {
  id: PRODUCT_ID,
  handle: 'glass-pad',
  title: 'Glass Pad',
  descriptionHtml: '<p>Smooth</p>',
  vendor: 'Example Brand',
  type: 'Mousepad',
  tags: ['glass', 'control'],
  images: [
    { id: IMAGE, url: 'https://cdn.example/pad.webp', alt: 'Black', width: 800, height: 600 },
  ],
  variants: [
    {
      id: VARIANT_A,
      title: 'Small',
      price: 89900,
      compareAtPrice: 129900,
      available: false,
      inventoryQuantity: 0,
      sku: 'GP-S',
      barcode: '8901234567890',
      options: ['Small'],
      image: { id: IMAGE, url: 'https://cdn.example/pad.webp' },
      weightGrams: 300,
    },
    {
      id: VARIANT_B,
      title: 'Large',
      price: 149905,
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
  updatedAt: new Date('2026-11-10T12:00:00Z'),
  preorder: false,
}

describe('rupees', () => {
  it("writes paise as Shopify's decimal string", () => {
    expect(rupees(89900)).toBe('899.00')
    expect(rupees(149905)).toBe('1499.05')
    expect(rupees(5)).toBe('0.05')
    expect(rupees(0)).toBe('0.00')
  })
})

describe('listProduct', () => {
  it("has the fields a feed reads from Shopify's /products.json", () => {
    const p = listProduct(pad)
    expect(p).toMatchObject({
      id: numericId(PRODUCT_ID),
      handle: 'glass-pad',
      title: 'Glass Pad',
      body_html: '<p>Smooth</p>',
      vendor: 'Example Brand',
      product_type: 'Mousepad',
      tags: ['glass', 'control'],
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-11-10T12:00:00.000Z',
      options: [{ name: 'Size', position: 1, values: ['Small', 'Large'] }],
    })
    expect(p.variants[0]).toMatchObject({
      id: numericId(VARIANT_A),
      price: '899.00',
      compare_at_price: '1299.00',
      available: false,
      sku: 'GP-S',
      grams: 300,
      option1: 'Small',
      position: 1,
      product_id: numericId(PRODUCT_ID),
    })
    expect(p.variants[0]?.featured_image?.src).toBe('https://cdn.example/pad.webp')
    expect(p.variants[1]).toMatchObject({
      price: '1499.05',
      compare_at_price: null,
      available: true,
      sku: '',
      featured_image: null,
    })
    expect(p.images[0]).toMatchObject({
      id: numericId(IMAGE),
      src: 'https://cdn.example/pad.webp',
      width: 800,
      height: 600,
      position: 1,
      variant_ids: [numericId(VARIANT_A)],
    })
  })

  it('never shows stock counts', () => {
    expect(JSON.stringify(listProduct(pad))).not.toContain('inventory_quantity')
    expect(JSON.stringify(productDetail(pad))).not.toContain('inventory_quantity')
  })
})

describe('productDetail', () => {
  it("has Shopify's /products/<h>.json shape: tags as one string, the first image as image", () => {
    const p = productDetail(pad)
    expect(p.tags).toBe('glass, control')
    expect(p.image?.src).toBe('https://cdn.example/pad.webp')
    expect(p.variants[0]).toMatchObject({
      price: '899.00',
      barcode: '8901234567890',
      weight: 0.3,
      weight_unit: 'kg',
      price_currency: 'INR',
      image_id: numericId(IMAGE),
    })
  })
})

describe('collectionJson', () => {
  it('writes a collection with its count', () => {
    expect(
      collectionJson({
        id: PRODUCT_ID,
        handle: 'glasspads',
        title: 'Glasspads',
        descriptionHtml: '',
        updatedAt: new Date('2026-11-01T00:00:00Z'),
        image: null,
        productsCount: 12,
      }),
    ).toMatchObject({ handle: 'glasspads', products_count: 12, image: null })
  })
})

describe('feedPaging', () => {
  const paging = (q: string) => feedPaging(new URLSearchParams(q))
  it("reads Shopify's limit and page, capped at 250", () => {
    expect(paging('')).toEqual({ limit: 30, page: 1 })
    expect(paging('limit=250&page=2')).toEqual({ limit: 250, page: 2 })
    expect(paging('limit=1000&page=0')).toEqual({ limit: 250, page: 1 })
    expect(paging('limit=abc&page=-3')).toEqual({ limit: 30, page: 1 })
    expect(paging('page=99999').page).toBe(100)
  })
})

describe('shopifyJsonPath', () => {
  it('rewrites the paths that share a page segment', () => {
    expect(shopifyJsonPath('/products/glass-pad.json')).toBe('/products/glass-pad/product.json')
    expect(shopifyJsonPath('/products/glass-pad.js')).toBe('/products/glass-pad/product.js')
    expect(shopifyJsonPath('/products/glass-pad.md')).toBe('/products/glass-pad/product.md')
    expect(shopifyJsonPath('/collections/glasspads.json')).toBe(
      '/collections/glasspads/collection.json',
    )
    expect(shopifyJsonPath('/products/glass-pad')).toBeNull()
    expect(shopifyJsonPath('/sitemap_products_1.xml')).toBe('/sitemap.xml/products')
    expect(shopifyJsonPath('/products.json')).toBeNull()
  })

  it('knows every Shopify JSON path', () => {
    for (const p of [
      '/products.json',
      '/collections.json',
      '/collections/all/products.json',
      '/products/x.js',
      '/collections/x.json',
    ])
      expect(isShopifyJsonPath(p)).toBe(true)
    expect(isShopifyJsonPath('/products/x')).toBe(false)
  })
})
