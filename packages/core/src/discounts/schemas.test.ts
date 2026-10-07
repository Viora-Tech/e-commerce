/** SOURCE OF TRUTH: discount input validation tests — WHAT: per-product amounts (one per chosen product, above zero, percent at most 100%) / WHY: issue #292, one code with a different amount per product */
import { describe, expect, it } from 'vitest'
import { DiscountInputSchema } from './schemas'

const X = '11111111-1111-4111-8111-111111111111'
const Y = '22222222-2222-4222-8222-222222222222'
const Z = '33333333-3333-4333-8333-333333333333'

const perProduct = {
  title: 'Killtoned',
  kind: 'code' as const,
  code: 'killtoned',
  method: 'fixed' as const,
  value: 0,
  appliesTo: 'products' as const,
  appliesToIds: [X, Y],
  productValues: { [X]: 20_000, [Y]: 30_000 } as Record<string, number> | null,
}

const issuePaths = (input: unknown): string[] => {
  const r = DiscountInputSchema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

describe('DiscountInputSchema: amount per product', () => {
  it('accepts a value for every chosen product, without a single value', () => {
    const r = DiscountInputSchema.safeParse(perProduct)
    expect(r.success).toBe(true)
    expect(r.data?.code).toBe('KILLTONED')
  })

  it('accepts percent rows up to 100%', () => {
    const pct = { ...perProduct, method: 'percent', productValues: { [X]: 10_000, [Y]: 1 } }
    expect(DiscountInputSchema.safeParse(pct).success).toBe(true)
  })

  it('needs a value above zero on every row', () => {
    expect(issuePaths({ ...perProduct, productValues: { [X]: 0, [Y]: 30_000 } })).toEqual([
      `productValues.${X}`,
    ])
  })

  it('needs a row for every chosen product', () => {
    expect(issuePaths({ ...perProduct, productValues: { [X]: 20_000 } })).toEqual([
      `productValues.${Y}`,
    ])
  })

  it('refuses a percent row above 100%', () => {
    const pct = { ...perProduct, method: 'percent', productValues: { [X]: 10_001, [Y]: 500 } }
    expect(issuePaths(pct)).toEqual([`productValues.${X}`])
  })

  it('refuses rows for products that are not chosen', () => {
    expect(issuePaths({ ...perProduct, productValues: { [X]: 1, [Y]: 1, [Z]: 1 } })).toEqual([
      `productValues.${Z}`,
    ])
  })

  it('refuses a map outside specific products or on free shipping', () => {
    expect(issuePaths({ ...perProduct, appliesTo: 'all', appliesToIds: [] })).toContain(
      'productValues',
    )
    expect(issuePaths({ ...perProduct, method: 'free_shipping' })).toContain('productValues')
  })

  it('refuses a map that is not keyed by product ids', () => {
    const r = DiscountInputSchema.safeParse({ ...perProduct, productValues: { x: 1 } })
    expect(r.success).toBe(false)
  })

  it('keeps the single-value rules for codes without a map', () => {
    const single = { ...perProduct, productValues: null }
    expect(issuePaths(single)).toEqual(['value'])
    expect(DiscountInputSchema.safeParse({ ...single, value: 20_000 }).success).toBe(true)
    const empty = { ...single, value: 20_000, productValues: {} }
    expect(DiscountInputSchema.safeParse(empty).success).toBe(true)
    const { productValues: _omit, ...old } = single
    expect(DiscountInputSchema.safeParse({ ...old, value: 20_000 }).success).toBe(true)
  })

  it('still asks for at least one product', () => {
    const none = { ...perProduct, appliesToIds: [], productValues: null, value: 1 }
    expect(issuePaths(none)).toEqual(['appliesToIds'])
  })
})
