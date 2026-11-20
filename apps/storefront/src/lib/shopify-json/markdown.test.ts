import { numericId } from '@commerce/core/theme-import'
import { describe, expect, it } from 'vitest'
import { productMarkdown } from './markdown'
import type { FeedProduct } from './shape'

const variant = {
  compareAtPrice: null,
  barcode: null,
  image: null,
  weightGrams: null,
}

const pad: FeedProduct = {
  id: '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7b',
  handle: 'glass-pad',
  title: 'Glass | Pad',
  descriptionHtml: '<p>Smooth <b>glass</b>.</p>',
  vendor: 'Example Brand',
  type: 'Mousepad',
  tags: [],
  images: [],
  variants: [
    {
      ...variant,
      id: '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7c',
      title: 'Small',
      price: 89900,
      available: false,
      inventoryQuantity: 0,
      sku: 'GP-S',
      options: ['Small'],
    },
    {
      ...variant,
      id: '019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7d',
      title: 'Large',
      price: 149900,
      available: true,
      inventoryQuantity: 4,
      sku: null,
      options: ['Large'],
    },
  ],
  options: [{ name: 'Size', values: ['Small', 'Large'] }],
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-11-10T12:00:00Z'),
  preorder: false,
}

describe('productMarkdown', () => {
  it('gives an agent the name, prices, stock per variant, options and policies', () => {
    const md = productMarkdown(pad, 'https://waimers.in')
    expect(md.startsWith('# Glass / Pad\n')).toBe(true)
    expect(md).toContain('https://waimers.in/products/glass-pad')
    expect(md).toContain('- Price: ₹899.00 to ₹1499.00')
    expect(md).toContain('- Availability: In stock')
    expect(md).toContain('- Size: Small, Large')
    const large = numericId('019a1b2c-3d4e-7f00-8a1b-2c3d4e5f6a7d')
    expect(md).toContain(
      `| Large | ₹1499.00 | In stock |  | https://waimers.in/products/glass-pad?variant=${large} |`,
    )
    expect(md).toContain('| Small | ₹899.00 | Sold out | GP-S |')
    expect(md).toContain('Smooth glass.')
    expect(md).toContain('- [Refund policy](https://waimers.in/policies/refund-policy)')
  })

  it('shows one price and no variant table for a one-variant product', () => {
    const one = { ...pad, variants: [pad.variants[1]] } as FeedProduct
    const md = productMarkdown(one, 'https://waimers.in')
    expect(md).toContain('- Price: ₹1499.00')
    expect(md).not.toContain('## Variants')
  })
})
