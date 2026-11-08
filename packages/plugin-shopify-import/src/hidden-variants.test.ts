import { describe, expect, it } from 'vitest'
import { mapVariant } from './shopify-api'

const gVariant = (price: string, availableForSale: boolean | undefined) => ({
  id: 'gid://shopify/ProductVariant/1',
  title: 'Red',
  sku: null,
  barcode: null,
  price,
  compareAtPrice: null,
  taxable: true,
  inventoryQuantity: 0,
  inventoryPolicy: 'DENY' as const,
  // Left out entirely when undefined, as an older snapshot without the field has it.
  ...(availableForSale === undefined ? {} : { availableForSale }),
  selectedOptions: [{ name: 'Colour', value: 'Red' }],
  image: null,
  inventoryItem: { tracked: true, harmonizedSystemCode: null, unitCost: null, measurement: null },
})

describe('hidden variants from Shopify (#934)', () => {
  it('hides a ₹0 variant Shopify would not sell', () => {
    expect(mapVariant(gVariant('0.00', false), ['Colour'], null).hiddenOnStore).toBe(true)
  })

  it('keeps a priced sold-out variant and a ₹0 one Shopify sells (free items) visible', () => {
    expect(mapVariant(gVariant('499.00', false), ['Colour'], null).hiddenOnStore).toBe(false)
    expect(mapVariant(gVariant('0.00', true), ['Colour'], null).hiddenOnStore).toBe(false)
    // An older snapshot without the field cannot tell, so nothing is hidden.
    expect(mapVariant(gVariant('0.00', undefined), ['Colour'], null).hiddenOnStore).toBe(false)
  })
})

describe('physical products from Shopify', () => {
  it('maps "This is a physical product" and leaves it out when Shopify did not say', () => {
    const base = gVariant('499.00', true)
    const download = {
      ...base,
      inventoryItem: { ...base.inventoryItem, requiresShipping: false },
    }
    expect(mapVariant(download, ['Colour'], null).requiresShipping).toBe(false)
    expect(mapVariant(base, ['Colour'], null).requiresShipping).toBeUndefined()
  })
})
