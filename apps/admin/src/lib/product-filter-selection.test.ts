import { createSerializer } from 'nuqs'
import { describe, expect, it } from 'vitest'
import { appliedFromGroups, clearGroups, hasFilter } from '@/components/table/filter-panel'
import { filterPanelContent } from '@/data/filter-panel'
import { ordersContent } from '@/data/orders'
import {
  FILTER_PARAMS,
  hasOrderFilters,
  NO_FILTERS,
  type OrderFilters,
  orderFilterGroups,
  orderFilterInput,
} from '@/lib/order-list-filters'
import {
  NO_PICK,
  namesFromRows,
  pickSummary,
  productState,
  toggleProduct,
  toggleVariant,
  variantPicked,
} from '@/lib/product-filter-selection'

const P1 = '00000001-0000-4000-8000-000000000000'
const P2 = '00000002-0000-4000-8000-000000000000'
const P3 = '00000003-0000-4000-8000-000000000000'
const S = '00000004-0000-4000-8000-000000000000'
const M = '00000005-0000-4000-8000-000000000000'
const L = '00000006-0000-4000-8000-000000000000'
const D = '00000007-0000-4000-8000-000000000000'
const ZZ = '00000008-0000-4000-8000-000000000000'
const X = '00000009-0000-4000-8000-000000000000'
const PAD = { id: P1, variantIds: [S, M, L] }
const copy = ordersContent.filters.picker
const NAMES = new Map(
  namesFromRows([
    {
      id: P1,
      title: 'Hachiware ICE Glasspad',
      variants: [
        { id: S, title: 'S' },
        { id: M, title: 'M' },
        { id: L, title: 'L' },
      ],
    },
    { id: P2, title: 'Mouse', variants: [{ id: D, title: 'Default' }] },
    { id: P3, title: 'Keyboard', variants: [] },
  ]),
)

describe('Product filter picks', () => {
  it('ticks a whole product, folding its single variants into it', () => {
    const some = toggleVariant(NO_PICK, PAD, S, true)
    expect(some).toEqual({ productIds: [], variantIds: [S] })
    expect(productState(some, PAD)).toBe('some')
    const all = toggleProduct(some, PAD, true)
    expect(all).toEqual({ productIds: [P1], variantIds: [] })
    expect(productState(all, PAD)).toBe('all')
    expect(variantPicked(all, PAD, M)).toBe(true)
    expect(toggleProduct(all, PAD, false)).toEqual(NO_PICK)
  })

  it('unticking one variant of a whole product keeps the others; the last tick makes it whole', () => {
    const whole = { productIds: [P1], variantIds: [] }
    const noM = toggleVariant(whole, PAD, M, false)
    expect(noM).toEqual({ productIds: [], variantIds: [S, L] })
    expect(toggleVariant(noM, PAD, M, true)).toEqual(whole)
    expect(toggleVariant(whole, PAD, M, true)).toBe(whole)
  })

  it('names the chip by its first pick and how many more', () => {
    expect(pickSummary(NO_PICK, NAMES, copy)).toBeNull()
    expect(pickSummary({ productIds: [P1], variantIds: [] }, NAMES, copy)).toBe(
      'Hachiware ICE Glasspad',
    )
    expect(pickSummary({ productIds: [P1, P2], variantIds: [X] }, NAMES, copy)).toBe(
      'Hachiware ICE Glasspad, +2',
    )
    expect(pickSummary({ productIds: [], variantIds: [M] }, NAMES, copy)).toBe(
      'Hachiware ICE Glasspad · M',
    )
    // Names not loaded yet (a reload): a count.
    expect(pickSummary({ productIds: [ZZ, P1], variantIds: [] }, NAMES, copy)).toBe('2 picked')
  })
})

describe('Orders Product filter group, chip and URL', () => {
  const picked: OrderFilters = { ...NO_FILTERS, productIds: [P1, P2], variantIds: [M] }

  it('shows "Product is …" or "Product is not …", and × clears picks and the switch', () => {
    const patches: Partial<OrderFilters>[] = []
    const groups = orderFilterGroups(
      picked,
      ordersContent.filters,
      (p) => patches.push(p),
      undefined,
      {
        names: NAMES,
        control: null,
      },
    )
    const [chip] = appliedFromGroups(groups, filterPanelContent)
    expect(chip).toMatchObject({
      key: 'products',
      field: 'Product',
      label: 'Hachiware ICE Glasspad, +2',
      negated: false,
    })
    chip?.onRemove()
    expect(patches).toEqual([{ productIds: [], variantIds: [], productNot: false }])

    const not = orderFilterGroups(
      { ...picked, productNot: true },
      ordersContent.filters,
      () => {},
      undefined,
      {
        names: NAMES,
        control: null,
      },
    )
    expect(appliedFromGroups(not, filterPanelContent)[0]?.negated).toBe(true)
    patches.length = 0
    clearGroups(groups)
    expect(patches).toContainEqual({ productIds: [], variantIds: [], productNot: false })
  })

  it('has no chip with nothing picked, even with Is not on', () => {
    const groups = orderFilterGroups(
      { ...NO_FILTERS, productNot: true },
      ordersContent.filters,
      () => {},
    )
    const group = groups.find((g) => g.key === 'products')
    expect(group && hasFilter(group)).toBe(false)
    expect(hasOrderFilters({ ...NO_FILTERS, productNot: true })).toBe(false)
    expect(orderFilterInput({ ...NO_FILTERS, productNot: true })).toEqual({})
  })

  it('drops ids that are not ids (a hand-edited URL), so the list still loads', () => {
    expect(orderFilterInput({ ...NO_FILTERS, productIds: ['junk', P1] })).toEqual({
      productIds: [P1],
    })
    expect(orderFilterInput({ ...NO_FILTERS, variantIds: ['junk'], productNot: true })).toEqual({})
  })

  it('sends the picks to orders.list, with Is not as excludeProducts', () => {
    expect(hasOrderFilters(picked)).toBe(true)
    expect(orderFilterInput(picked)).toEqual({ productIds: [P1, P2], variantIds: [M] })
    expect(orderFilterInput({ ...picked, productNot: true, payment: ['paid'] })).toEqual({
      paymentStatus: ['paid'],
      productIds: [P1, P2],
      variantIds: [M],
      excludeProducts: true,
    })
  })

  it('keeps the picks in the URL and reads them back (reload, back/forward)', () => {
    const serialize = createSerializer(FILTER_PARAMS)
    const url = serialize('/orders', {
      productIds: picked.productIds,
      variantIds: picked.variantIds,
      productNot: true,
    })
    const params = new URL(url, 'https://admin.test').searchParams
    expect(params.get('productIds')).toBe(`${P1},${P2}`)
    expect(params.get('variantIds')).toBe(M)
    expect(params.get('productNot')).toBe('true')
    expect(FILTER_PARAMS.productIds.parse(params.get('productIds') ?? '')).toEqual([P1, P2])
    expect(FILTER_PARAMS.variantIds.parse(params.get('variantIds') ?? '')).toEqual([M])
    expect(FILTER_PARAMS.productNot.parse(params.get('productNot') ?? '')).toBe(true)
    // The defaults leave the URL clean.
    expect(serialize('/orders', { productIds: [], variantIds: [], productNot: false })).toBe(
      '/orders',
    )
  })

  it('reads an old ?product=pd170 link as a chip, but leaves it out of the Filter menu', () => {
    const groups = orderFilterGroups(
      { ...NO_FILTERS, product: 'pd170' },
      ordersContent.filters,
      () => {},
    )
    expect(appliedFromGroups(groups, filterPanelContent).map((c) => [c.field, c.label])).toEqual([
      ['Product title or SKU', 'pd170'],
    ])
    expect(orderFilterInput({ ...NO_FILTERS, product: 'pd170' })).toEqual({ product: 'pd170' })
    // The Filter menu offers the picker, never the retired text box.
    const offered = groups.filter((g) => g.inMenu !== false).map((g) => g.key)
    expect(offered).toContain('products')
    expect(offered).not.toContain('product')
  })
})
