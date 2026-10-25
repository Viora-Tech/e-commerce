import { describe, expect, it } from 'vitest'
import {
  type CommissionLine,
  computeCommission,
  defaultRuleFor,
  levelFor,
  orderValuePaise,
} from '../src/commission'
import { DEFAULT_COUPON_SITES } from '../src/fraud'
import {
  defaultAffiliateSettings,
  defaultProgramRules,
  PROGRAM_SLUG,
  type ProgramRules,
  parseProgramRules,
  programPart,
  storePart,
  withProgramRules,
} from '../src/settings'

const P1 = '00000000-0000-4000-8000-000000000001'
const P2 = '00000000-0000-4000-8000-000000000002'
const P3 = '00000000-0000-4000-8000-000000000003'
const C1 = '00000000-0000-4000-8000-0000000000c1'

const line = (over: Partial<CommissionLine> = {}): CommissionLine => ({
  productId: P1,
  collectionIds: [],
  quantity: 1,
  unitPricePaise: 1180_00,
  gstRatePercent: 18,
  giftCard: false,
  ...over,
})

const rules = (over: Partial<ProgramRules> = {}): ProgramRules => ({
  ...defaultProgramRules,
  ...over,
})

describe('settings split', () => {
  it('reads a whole v1 entry as the same program rules and the same store settings', () => {
    const v1 = {
      active: false,
      commission: { type: 'percent', bp: 1500 },
      scope: 'lifetime',
      lifetimeDays: 90,
      cookieDays: 14,
      approval: 'auto',
      holdDays: 10,
      minPayoutPaise: 1000_00,
      coupon: { enabled: false, bp: 500 },
      tds: { enabled: true, bp: 200, noPanBp: 2000, thresholdPaise: 20_000_00 },
      tiers: [{ name: 'Gold', minSalesPaise: 1000_00, bp: 2000 }],
      pitch: 'Join us',
      terms: 'Be nice',
    }
    const program = parseProgramRules(v1)
    expect(program).toMatchObject({
      commission: { type: 'percent', bp: 1500 },
      scope: 'lifetime',
      lifetimeDays: 90,
      approval: 'auto',
      coupon: { enabled: false, bp: 500 },
      pitch: 'Join us',
      excludes: [],
      levels: [],
    })
    expect(program).not.toHaveProperty('holdDays')
    const merged = withProgramRules({ ...defaultAffiliateSettings, holdDays: 10 }, program)
    expect(merged.holdDays).toBe(10)
    expect(programPart(merged)).toEqual(program)
    expect(storePart(merged)).toEqual({
      active: true,
      cookieDays: 30,
      holdDays: 10,
      minPayoutPaise: 500_00,
      tds: defaultAffiliateSettings.tds,
      gst: { enabled: true, bp: 1800 },
      requirePanAboveThreshold: false,
      autoEnrol: { mode: 'off', programId: null, minOrderPaise: 0 },
      fraud: { couponSites: [...DEFAULT_COUPON_SITES], spikeMultiple: 3 },
    })
  })

  it('falls back to the defaults for unreadable rules', () => {
    expect(parseProgramRules({ commission: 'lots' })).toEqual(defaultProgramRules)
  })

  it('accepts link slugs of lower-case letters, digits and dashes', () => {
    expect(PROGRAM_SLUG.test('creators-2026')).toBe(true)
    expect(PROGRAM_SLUG.test('Creators')).toBe(false)
    expect(PROGRAM_SLUG.test('-x')).toBe(false)
  })
})

describe('rule precedence', () => {
  const order = (lines: CommissionLine[], discountPaise = 0) => ({
    subtotalPaise: lines.reduce((s, l) => s + l.unitPricePaise * l.quantity, 0),
    discountPaise,
    lines,
  })

  it('leaves excluded products and collections out of the base and the commission', () => {
    const r = rules({
      excludes: [
        { target: 'product', id: P2, label: '' },
        { target: 'collection', id: C1, label: '' },
      ],
      // An override on an excluded product does not bring it back.
      overrides: [{ target: 'product', id: P2, label: '', rule: { type: 'percent', bp: 5000 } }],
    })
    const o = order([line(), line({ productId: P2 }), line({ productId: P3, collectionIds: [C1] })])
    expect(computeCommission(o, r)).toEqual({ basePaise: 1000_00, commissionPaise: 100_00 })
  })

  it('product override > collection override > own rate > level > default', () => {
    const r = rules({
      commission: { type: 'percent', bp: 1000 },
      levels: [{ minOrderPaise: 2000_00, rule: { type: 'percent', bp: 1200 } }],
      overrides: [
        { target: 'product', id: P2, label: '', rule: { type: 'percent', bp: 2000 } },
        { target: 'collection', id: C1, label: '', rule: { type: 'percent', bp: 500 } },
      ],
    })
    const o = order([
      line({ productId: P2, collectionIds: [C1] }), // product 20%: 200
      line({ collectionIds: [C1] }), // collection 5%: 50
      line({ productId: P3 }), // default line
    ])
    // ₹3,540 order passes the ₹2,000 level: 12% of 1,000 = 120.
    expect(computeCommission(o, r).commissionPaise).toBe(370_00)
    // The affiliate's own rate beats the level.
    expect(computeCommission(o, r, null, { type: 'percent', bp: 1500 }).commissionPaise).toBe(
      400_00,
    )
    // Below the level: the program default.
    const small = order([line({ productId: P3 })])
    expect(computeCommission(small, r).commissionPaise).toBe(100_00)
  })

  it('measures the level on goods after discount with GST, without gift cards', () => {
    const o = order(
      [line({ unitPricePaise: 2360_00 }), line({ giftCard: true, unitPricePaise: 500_00 })],
      286_00,
    )
    // 2,860 goods; the 286 discount splits 236 / 50; the mat is 2,124 incl. GST.
    expect(orderValuePaise(o)).toBe(2124_00)
    const levels = [
      { minOrderPaise: 1000_00, rule: { type: 'percent' as const, bp: 1100 } },
      { minOrderPaise: 2000_00, rule: { type: 'percent' as const, bp: 1300 } },
      { minOrderPaise: 3000_00, rule: { type: 'percent' as const, bp: 1500 } },
    ]
    expect(levelFor(levels, orderValuePaise(o))?.rule).toEqual({ type: 'percent', bp: 1300 })
    expect(levelFor(levels, 999_00)).toBeNull()
    // The commission stays on the ex-GST base: 2,124 / 1.18 = 1,800 at 13% = 234.
    expect(computeCommission(o, rules({ levels })).commissionPaise).toBe(234_00)
  })

  it('lets a tier lift whichever percent wins, and leaves a flat own rate once per order', () => {
    const tier = { name: 'Gold', minSalesPaise: 0, bp: 1500 }
    const o = order([line(), line({ productId: P2 })])
    // Own rate 12% lifted to the tier's 15%.
    expect(computeCommission(o, rules(), tier, { type: 'percent', bp: 1200 }).commissionPaise).toBe(
      300_00,
    )
    // An own rate above the tier stays.
    expect(computeCommission(o, rules(), tier, { type: 'percent', bp: 2000 }).commissionPaise).toBe(
      400_00,
    )
    // A flat own rate: once per order, the tier does not apply.
    expect(
      computeCommission(o, rules(), tier, { type: 'flat', paise: 75_00 }).commissionPaise,
    ).toBe(75_00)
    expect(defaultRuleFor(rules(), 0, null)).toEqual({ type: 'percent', bp: 1000 })
  })
})
