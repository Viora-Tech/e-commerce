/** SOURCE OF TRUTH: the stock-focused bulk editor opened from Inventory (#1033) */
import { describe, expect, it } from 'vitest'
import { routes } from '@/lib/routes'
import { COLUMN_DEFS, STOCK_FOCUS_HIDDEN, STOCK_GROUP_KEY } from './bulk-edit-columns'

describe('bulk editor opened from Inventory', () => {
  it('shows only the product, variant and SKU next to the stock columns', () => {
    const shown = COLUMN_DEFS.map((d) => d.key).filter((k) => !STOCK_FOCUS_HIDDEN.includes(k))
    expect(shown).toEqual(['title', 'variantTitle', 'sku'])
    expect(STOCK_FOCUS_HIDDEN).not.toContain(STOCK_GROUP_KEY)
  })

  it('carries the focus and the reason for edits in the link', () => {
    const id = '0191f3a0-0000-7000-8000-000000000001'
    expect(routes.products.bulkEdit([id], { reason: 'received' })).toBe(
      `/products/bulk-edit?ids=${id}&focus=stock&reason=received`,
    )
    expect(routes.products.bulkEdit([id])).toBe(`/products/bulk-edit?ids=${id}`)
  })
})
