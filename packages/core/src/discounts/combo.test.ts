/** SOURCE OF TRUTH: combo deal tests — WHAT: what a combo takes off a cart and its saving / WHY: guard the combo deals discount type */
import type { DiscountCombo } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { comboAmount, comboSaving } from './combo'
import {
  type DiscountCartLine,
  type DiscountRule,
  describeDiscountValue,
  discountClass,
  evaluateDiscount,
} from './evaluate'
import { DiscountInputSchema } from './schemas'

const line = (
  productId: string,
  quantity: number,
  unitPricePaise: number,
  variantId?: string,
): DiscountCartLine => ({ productId, variantId, quantity, unitPricePaise })

const price = (items: [string, number][], value: number): DiscountCombo => ({
  scope: 'products',
  items: items.map(([id, quantity]) => ({ id, quantity })),
  method: 'price',
  value,
})

describe('comboSaving', () => {
  const combo = price([['a', 1]], 0)
  it('a combo price saves the difference, never below zero', () => {
    expect(comboSaving({ ...combo, value: 80_000 }, 100_000)).toBe(20_000)
    expect(comboSaving({ ...combo, value: 120_000 }, 100_000)).toBe(0)
  })
  it('a percentage rounds half up, an amount never passes the set', () => {
    expect(comboSaving({ ...combo, method: 'percent', value: 1_250 }, 99_99)).toBe(1_250)
    expect(comboSaving({ ...combo, method: 'fixed', value: 500_000 }, 100_000)).toBe(100_000)
  })
})

describe('comboAmount', () => {
  const shirtAndCap = price(
    [
      ['shirt', 1],
      ['cap', 1],
    ],
    1_500_00,
  )

  it('applies once per full set the cart holds', () => {
    const lines = [line('shirt', 3, 1_000_00), line('cap', 2, 800_00)]
    const r = comboAmount(lines, [shirtAndCap])
    // Two full sets (only two caps): each 1800 → 1500 saves 300.
    expect(r.amountPaise).toBe(2 * 300_00)
    expect(r.uses).toEqual([{ combo: 0, times: 2, savingPaise: 600_00 }])
  })

  it('gives nothing when a set is incomplete', () => {
    expect(comboAmount([line('shirt', 2, 1_000_00)], [shirtAndCap]).amountPaise).toBe(0)
  })

  it('needs every quantity in the set', () => {
    const pair = price([['sock', 2]], 300_00)
    expect(comboAmount([line('sock', 3, 200_00)], [pair]).amountPaise).toBe(100_00)
    expect(comboAmount([line('sock', 1, 200_00)], [pair]).amountPaise).toBe(0)
  })

  it('takes the dearest units of a product combo first', () => {
    const lines = [line('shirt', 1, 900_00, 'v-s'), line('shirt', 1, 1_200_00, 'v-l')]
    const combo: DiscountCombo = { ...price([['shirt', 1]], 0), method: 'percent', value: 1_000 }
    expect(comboAmount(lines, [combo]).amountPaise).toBe(120_00 + 90_00)
  })

  it('matches exact variants for a variant combo', () => {
    const lines = [line('shirt', 2, 1_000_00, 'v-red'), line('shirt', 2, 1_000_00, 'v-blue')]
    const combo: DiscountCombo = {
      scope: 'variants',
      items: [{ id: 'v-red', quantity: 1 }],
      method: 'fixed',
      value: 100_00,
    }
    expect(comboAmount(lines, [combo])).toEqual({
      amountPaise: 200_00,
      uses: [{ combo: 0, times: 2, savingPaise: 200_00 }],
    })
  })

  it('never uses a unit twice when combos overlap, best saving first', () => {
    const lines = [line('shirt', 1, 1_000_00), line('cap', 1, 800_00), line('belt', 1, 500_00)]
    const small = price(
      [
        ['shirt', 1],
        ['cap', 1],
      ],
      1_700_00,
    ) // saves 100
    const big = price(
      [
        ['shirt', 1],
        ['belt', 1],
      ],
      1_000_00,
    ) // saves 500
    const r = comboAmount(lines, [small, big])
    expect(r.amountPaise).toBe(500_00)
    expect(r.uses).toEqual([{ combo: 1, times: 1, savingPaise: 500_00 }])
  })

  it('mixes combos when the cart holds both', () => {
    const lines = [line('shirt', 2, 1_000_00), line('cap', 1, 800_00), line('belt', 1, 500_00)]
    const small = price(
      [
        ['shirt', 1],
        ['cap', 1],
      ],
      1_700_00,
    )
    const big = price(
      [
        ['shirt', 1],
        ['belt', 1],
      ],
      1_000_00,
    )
    expect(comboAmount(lines, [small, big]).amountPaise).toBe(600_00)
  })

  it('ties go to the earlier combo', () => {
    const lines = [line('a', 1, 100_00)]
    const r = comboAmount(lines, [price([['a', 1]], 50_00), price([['a', 1]], 50_00)])
    expect(r.uses).toEqual([{ combo: 0, times: 1, savingPaise: 50_00 }])
  })

  it('ignores empty combos', () => {
    expect(comboAmount([line('a', 1, 100_00)], [price([], 0)])).toEqual({
      amountPaise: 0,
      uses: [],
    })
  })
})

describe('combo deal discount', () => {
  const rule: DiscountRule = {
    id: 'c1',
    title: 'Shirt + cap combo',
    kind: 'automatic',
    code: null,
    method: 'fixed',
    value: 0,
    minSubtotalPaise: null,
    appliesTo: 'all',
    appliesToIds: [],
    type: 'combo',
    combos: [
      price(
        [
          ['shirt', 1],
          ['cap', 1],
        ],
        1_500_00,
      ),
    ],
    usageLimit: null,
    usagePerCustomer: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    status: 'active',
  }
  const cart = { lines: [line('shirt', 1, 1_000_00), line('cap', 1, 800_00)] }

  it('evaluates to the combo saving and stacks as a product discount', () => {
    const r = evaluateDiscount(cart, rule)
    expect(r.ok && r.amountPaise).toBe(300_00)
    expect(discountClass(rule)).toBe('products')
  })

  it('is not applicable without a full set, and keeps the usual checks', () => {
    const r = evaluateDiscount({ lines: [line('shirt', 1, 1_000_00)] }, rule)
    expect(r.ok ? null : r.reason).toBe('no_eligible_items')
    const ended = evaluateDiscount(cart, { ...rule, endsAt: new Date('2020-01-01') })
    expect(ended.ok ? null : ended.reason).toBe('expired')
  })

  it('describes itself by its combo count', () => {
    expect(describeDiscountValue(rule)).toBe('1 combo')
  })

  it('validates: at least one combo, a value per combo, each item once', () => {
    const input = {
      title: 'Combo',
      type: 'combo',
      kind: 'automatic',
      method: 'fixed',
      value: 0,
      combos: [
        {
          scope: 'products',
          items: [{ id: '0198a6d2-0000-7000-8000-000000000001', quantity: 1 }],
          method: 'price',
          value: 100_00,
        },
      ],
    }
    expect(DiscountInputSchema.safeParse(input).success).toBe(true)
    expect(DiscountInputSchema.safeParse({ ...input, combos: [] }).success).toBe(false)
    const dup = input.combos[0] as (typeof input.combos)[number]
    expect(
      DiscountInputSchema.safeParse({
        ...input,
        combos: [{ ...dup, items: [...dup.items, ...dup.items] }],
      }).success,
    ).toBe(false)
    expect(
      DiscountInputSchema.safeParse({ ...input, combos: [{ ...dup, value: 0 }] }).success,
    ).toBe(false)
  })
})
