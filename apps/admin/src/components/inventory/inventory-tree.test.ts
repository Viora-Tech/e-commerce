import { describe, expect, it } from 'vitest'
import type { InventoryRow } from './inventory-columns'
import { expandAll, groupByProduct, isProductLine, productLineId } from './inventory-tree'

function row(productId: string, variantId: string, available: number, extra = {}): InventoryRow {
  return {
    variantId,
    productId,
    productTitle: `Product ${productId}`,
    variantTitle: `Variant ${variantId}`,
    sku: `SKU-${variantId}`,
    imageUrl: `https://img/${variantId}.jpg`,
    productImageUrl: `https://img/${productId}.jpg`,
    onHand: available + 1,
    committed: 1,
    available,
    incoming: 2,
    costPaise: 100,
    ...extra,
  }
}

describe('groupByProduct', () => {
  it('makes one summed line per multi-SKU product with its SKUs nested in order', () => {
    const lines = groupByProduct([row('p1', 'a', 3), row('p1', 'b', 5), row('p1', 'c', -1)])
    expect(lines).toHaveLength(1)
    const [line] = lines
    expect(line?.variantId).toBe(productLineId('p1'))
    expect(line?.available).toBe(7)
    expect(line?.onHand).toBe(10)
    expect(line?.committed).toBe(3)
    expect(line?.incoming).toBe(6)
    expect(line?.sku).toBeNull()
    expect(line?.imageUrl).toBe('https://img/p1.jpg')
    expect(line?.variants?.map((v) => v.variantId)).toEqual(['a', 'b', 'c'])
    expect(line?.variants?.every((v) => v.nested)).toBe(true)
  })

  it('keeps a single-SKU product as that SKU, so it is edited inline', () => {
    const only = row('p2', 'x', 4)
    const [line] = groupByProduct([only])
    expect(line).toBe(only)
    expect(line && isProductLine(line)).toBe(false)
  })

  it('keeps the API order of products and falls back to the SKU image without a cover', () => {
    const lines = groupByProduct([
      row('p2', 'x', 1),
      row('p1', 'a', 1, { productImageUrl: null }),
      row('p1', 'b', 1, { productImageUrl: null }),
    ])
    expect(lines.map((l) => l.productId)).toEqual(['p2', 'p1'])
    expect(lines[1]?.imageUrl).toBe('https://img/a.jpg')
  })
})

describe('expandAll', () => {
  it('opens every product line, or none', () => {
    const lines = groupByProduct([row('p1', 'a', 1), row('p1', 'b', 1), row('p2', 'x', 1)])
    expect(expandAll(lines, true)).toEqual({ [productLineId('p1')]: true })
    expect(expandAll(lines, false)).toEqual({})
  })
})
