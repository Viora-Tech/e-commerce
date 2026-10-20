import { describe, expect, it } from 'vitest'
import { parseProductsCsv } from './csv-products'
import { mapVariant } from './shopify-api'
import type { NVariant } from './types'
import { preorderFrom } from './write-products'

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
