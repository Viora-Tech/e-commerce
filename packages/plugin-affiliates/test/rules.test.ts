import {
  attributionFromVisit,
  decodeAttribution,
  encodeAttribution,
} from '@commerce/core/marketing'
import { describe, expect, it } from 'vitest'
import {
  type CommissionLine,
  computeCommission,
  lineBasePaise,
  scaleForRefund,
  tierFor,
} from '../src/commission'
import { addressKey, phoneKey, selfReferral } from '../src/fraud'
import { canReverse, eligibleAt, isDue, withinCookieWindow, withinLifetime } from '../src/hold'
import { defaultAffiliateSettings, normaliseRefCode, parseAffiliateSettings } from '../src/settings'
import { financialYearLabel, financialYearStart, tdsForCredit } from '../src/tds'

const P1 = '00000000-0000-4000-8000-000000000001'
const P2 = '00000000-0000-4000-8000-000000000002'
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

describe('commission maths', () => {
  it('takes GST out of the net sale and leaves shipping out', () => {
    const order = { subtotalPaise: 1180_00, discountPaise: 0, lines: [line()] }
    expect(lineBasePaise(line(), order)).toBe(1000_00)
    const r = computeCommission(order, defaultAffiliateSettings)
    expect(r).toEqual({ basePaise: 1000_00, commissionPaise: 100_00 })
  })

  it('shares the order discount across lines before GST', () => {
    const order = {
      subtotalPaise: 2360_00,
      discountPaise: 236_00,
      lines: [line(), line({ productId: P2 })],
    }
    // Each line: 1180 - 118 = 1062 incl. 18% GST = 900 net.
    expect(computeCommission(order, defaultAffiliateSettings).basePaise).toBe(1800_00)
  })

  it('earns nothing on gift cards', () => {
    const order = {
      subtotalPaise: 500_00,
      discountPaise: 0,
      lines: [line({ giftCard: true, unitPricePaise: 500_00 })],
    }
    expect(computeCommission(order, defaultAffiliateSettings)).toEqual({
      basePaise: 0,
      commissionPaise: 0,
    })
  })

  it('uses product overrides before collection overrides before the default', () => {
    const settings = {
      ...defaultAffiliateSettings,
      overrides: [
        {
          target: 'collection' as const,
          id: C1,
          label: '',
          rule: { type: 'percent' as const, bp: 500 },
        },
        {
          target: 'product' as const,
          id: P2,
          label: '',
          rule: { type: 'percent' as const, bp: 2000 },
        },
      ],
    }
    const order = {
      subtotalPaise: 3540_00,
      discountPaise: 0,
      lines: [
        line({ productId: P2, collectionIds: [C1] }), // product override 20%: 200
        line({ collectionIds: [C1] }), // collection 5%: 50
        line({ productId: '00000000-0000-4000-8000-000000000003' }), // default 10%: 100
      ],
    }
    expect(computeCommission(order, settings).commissionPaise).toBe(350_00)
  })

  it('pays a flat default once per order and flat overrides per unit, never above the sale', () => {
    const settings = {
      ...defaultAffiliateSettings,
      commission: { type: 'flat' as const, paise: 150_00 },
      overrides: [
        {
          target: 'product' as const,
          id: P2,
          label: '',
          rule: { type: 'flat' as const, paise: 30_00 },
        },
      ],
    }
    const order = {
      subtotalPaise: 1180_00 * 3,
      discountPaise: 0,
      lines: [line(), line({ productId: P2, quantity: 2 })],
    }
    expect(computeCommission(order, settings).commissionPaise).toBe(150_00 + 60_00)
    const tiny = {
      subtotalPaise: 59_00,
      discountPaise: 0,
      lines: [line({ unitPricePaise: 59_00 })],
    }
    expect(computeCommission(tiny, settings).commissionPaise).toBe(50_00)
  })

  it('lifts the default percent with the highest tier reached', () => {
    const tiers = [
      { name: 'Silver', minSalesPaise: 10_000_00, bp: 1200 },
      { name: 'Gold', minSalesPaise: 50_000_00, bp: 1500 },
    ]
    expect(tierFor(tiers, 5_000_00)).toBeNull()
    expect(tierFor(tiers, 60_000_00)?.name).toBe('Gold')
    const order = { subtotalPaise: 1180_00, discountPaise: 0, lines: [line()] }
    expect(
      computeCommission(order, defaultAffiliateSettings, tierFor(tiers, 20_000_00)).commissionPaise,
    ).toBe(120_00)
  })

  it('shrinks with a partial refund and vanishes with a full one', () => {
    expect(scaleForRefund(100_00, 1000_00, 250_00)).toBe(75_00)
    expect(scaleForRefund(100_00, 1000_00, 1000_00)).toBe(0)
  })
})

describe('hold and reversal', () => {
  const delivered = new Date('2026-10-01T10:00:00Z')
  it('becomes due after delivery plus the hold days, unless flagged', () => {
    const at = eligibleAt(delivered, 7)
    expect(at.toISOString()).toBe('2026-10-08T10:00:00.000Z')
    expect(
      isDue({ status: 'pending', eligibleAt: at, flag: null }, new Date('2026-10-08T10:00:00Z')),
    ).toBe(true)
    expect(
      isDue({ status: 'pending', eligibleAt: at, flag: null }, new Date('2026-10-07T10:00:00Z')),
    ).toBe(false)
    expect(isDue({ status: 'pending', eligibleAt: null, flag: null }, new Date('2027-01-01'))).toBe(
      false,
    )
    expect(
      isDue({ status: 'pending', eligibleAt: at, flag: 'same_email' }, new Date('2027-01-01')),
    ).toBe(false)
  })

  it('never reverses money already paid', () => {
    expect(canReverse('pending')).toBe(true)
    expect(canReverse('approved')).toBe(true)
    expect(canReverse('paid')).toBe(false)
    expect(canReverse('reversed')).toBe(false)
  })

  it('counts a link inside the cookie window and a returning customer inside the lifetime', () => {
    const click = new Date('2026-10-01T00:00:00Z')
    expect(withinCookieWindow(click, new Date('2026-10-30T00:00:00Z'), 30)).toBe(true)
    expect(withinCookieWindow(click, new Date('2026-11-01T00:00:00Z'), 30)).toBe(false)
    expect(withinLifetime(click, new Date('2027-09-01T00:00:00Z'), 365)).toBe(true)
    expect(withinLifetime(click, new Date('2027-10-05T00:00:00Z'), 365)).toBe(false)
  })
})

describe('attribution', () => {
  it('reads ?ref= into the touch and keeps it through the cookie', () => {
    const a = attributionFromVisit({
      landingUrl: 'https://shop.example/products/x?ref=Asha-K',
      referrer: null,
    })
    expect(a.ref).toBe('asha-k')
    expect(a.channel).toBe('affiliate')
    expect(decodeAttribution(encodeAttribution(a))?.ref).toBe('asha-k')
  })

  it('keeps a tagged campaign as the merchant tagged it', () => {
    const a = attributionFromVisit({
      landingUrl: 'https://shop.example/?ref=asha&utm_source=google&utm_medium=cpc',
      referrer: null,
    })
    expect(a.channel).toBe('paid_search')
    expect(a.ref).toBe('asha')
  })

  it('refuses codes that cannot be ours', () => {
    expect(normaliseRefCode('<script>')).toBeNull()
    expect(normaliseRefCode('a')).toBeNull()
    expect(normaliseRefCode(' ASHA ')).toBe('asha')
  })

  it('falls back to defaults for an unreadable program', () => {
    expect(parseAffiliateSettings({ commission: 'lots' })).toEqual(defaultAffiliateSettings)
  })
})

describe('fraud guards', () => {
  const affiliate = {
    customerId: 'cust-a',
    email: 'Asha@Example.com',
    phoneIndex: 'idx-a',
    addressKeys: [addressKey('12, MG Road', '560 001') as string],
  }
  const clean = {
    customerId: 'cust-b',
    email: 'b@example.com',
    phoneIndex: 'idx-b',
    addressKey: null,
  }

  it('catches the affiliate buying from their own account, email, phone or address', () => {
    expect(selfReferral(affiliate, { ...clean, customerId: 'cust-a' })).toBe('own_account')
    expect(selfReferral(affiliate, { ...clean, email: ' asha@example.com' })).toBe('same_email')
    expect(selfReferral(affiliate, { ...clean, phoneIndex: 'idx-a' })).toBe('same_phone')
    expect(
      selfReferral(affiliate, { ...clean, addressKey: addressKey('12 mg road', '560001') }),
    ).toBe('same_address')
    expect(selfReferral(affiliate, clean)).toBeNull()
  })

  it('compares Indian phones by their last ten digits', () => {
    expect(phoneKey('+91 98765 43210')).toBe('9876543210')
    expect(phoneKey('09876543210')).toBe('9876543210')
    expect(phoneKey('12345')).toBeNull()
  })
})

describe('TDS', () => {
  const tds = defaultAffiliateSettings.tds
  it('deducts nothing until the yearly threshold is passed', () => {
    expect(
      tdsForCredit({
        settings: tds,
        yearCreditedPaise: 10_000_00,
        yearTdsPaise: 0,
        creditPaise: 5_000_00,
        hasPan: true,
      }),
    ).toBe(0)
  })

  it('catches up on the whole year once the threshold is crossed', () => {
    // 18,000 earlier + 4,000 now = 22,000; 2% = 440 on the year, all on this credit.
    expect(
      tdsForCredit({
        settings: tds,
        yearCreditedPaise: 18_000_00,
        yearTdsPaise: 0,
        creditPaise: 4_000_00,
        hasPan: true,
      }),
    ).toBe(440_00)
    // Then 2% of each credit.
    expect(
      tdsForCredit({
        settings: tds,
        yearCreditedPaise: 22_000_00,
        yearTdsPaise: 440_00,
        creditPaise: 1_000_00,
        hasPan: true,
      }),
    ).toBe(20_00)
  })

  it('uses the higher rate without a PAN, and nothing when switched off', () => {
    expect(
      tdsForCredit({
        settings: tds,
        yearCreditedPaise: 20_000_00,
        yearTdsPaise: 0,
        creditPaise: 1_000_00,
        hasPan: false,
      }),
    ).toBe(1_000_00)
    expect(
      tdsForCredit({
        settings: { ...tds, enabled: false },
        yearCreditedPaise: 50_000_00,
        yearTdsPaise: 0,
        creditPaise: 1_000_00,
        hasPan: true,
      }),
    ).toBe(0)
  })

  it('starts the financial year on 1 April in India', () => {
    expect(financialYearStart(new Date('2026-04-01T00:00:00+05:30')).toISOString()).toBe(
      '2026-03-31T18:30:00.000Z',
    )
    expect(financialYearStart(new Date('2026-03-31T23:00:00+05:30')).toISOString()).toBe(
      '2025-03-31T18:30:00.000Z',
    )
    expect(financialYearLabel(new Date('2026-10-23'))).toBe('FY 2026-27')
  })
})
