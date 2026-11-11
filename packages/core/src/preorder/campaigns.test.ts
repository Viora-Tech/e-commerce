/** SOURCE OF TRUTH: pre-order campaign rule tests — WHAT: which settings a campaign gives a product, where it applies, its price and cart lines / WHY: guard Products › Pre-orders */
import { describe, expect, it } from 'vitest'
import {
  campaignApplies,
  campaignColours,
  campaignLineIsPreorder,
  campaignNoteSource,
  mixedCartVerdict,
  ownFields,
  PreorderCampaignCreateSchema,
  type PreorderCampaignTerms,
  PreorderCampaignUpdateSchema,
  preorderUnitPrice,
  soldOutInCartOutcome,
} from './campaigns'
import { type ProductPreorderRow, resolvePreorderSettings } from './settings'

const campaign: PreorderCampaignTerms = {
  id: 'c1',
  name: 'Lofree launch',
  status: 'active',
  shipDate: new Date('2026-12-01T00:00:00Z'),
  shipsInDays: null,
  limit: 10,
  paymentMode: 'percentage',
  depositPaise: null,
  depositPercent: 20,
  discountType: 'percentage',
  discountValue: 10,
  marketIds: [],
  locationIds: [],
  channels: ['online_store', 'social', 'ai_agents'],
  mixedCart: 'split',
  soldOutInCart: 'preorder',
  content: {
    buttonText: 'Pre-order now',
    badgeText: 'Launching soon',
    orderNote: 'Ships {ship_date}',
  },
  design: {},
}

const product: ProductPreorderRow = {
  preorderEnabled: false,
  preorderShipDate: null,
  preorderShipsInDays: 30,
  preorderLimit: 3,
  preorderButtonLabel: 'Reserve',
  preorderPaymentMode: 'full',
  preorderDepositPaise: null,
  preorderDepositPercent: null,
}

describe('resolvePreorderSettings with a campaign', () => {
  it('takes every setting from the campaign and turns pre-order on', () => {
    expect(resolvePreorderSettings(product, null, campaign)).toEqual({
      enabled: true,
      shipDate: campaign.shipDate,
      shipsInDays: null,
      limit: 10,
      buttonLabel: 'Pre-order now',
      paymentMode: 'percentage',
      depositPaise: null,
      depositPercent: 20,
      campaignId: 'c1',
    })
  })

  it("keeps the product's own settings where it marks them", () => {
    const own = { ...product, preorderOwn: ['shipping', 'limit', 'button', 'payment'] }
    const s = resolvePreorderSettings(own, null, campaign)
    expect(s.shipsInDays).toBe(30)
    expect(s.shipDate).toBeNull()
    expect(s.limit).toBe(3)
    expect(s.buttonLabel).toBe('Reserve')
    expect(s.paymentMode).toBe('full')
  })

  // Per-variant pre-order limit: the variant's own limit wins over the campaign's and the product's.
  it("a variant's own limit wins over the campaign's, and blank uses the campaign's", () => {
    expect(resolvePreorderSettings(product, { limit: 2 }, campaign).limit).toBe(2)
    expect(resolvePreorderSettings(product, { limit: null }, campaign).limit).toBe(10)
    expect(resolvePreorderSettings(product, { enabled: false }, campaign).limit).toBe(10)
  })

  it("a variant's own limit wins over the product's kept limit too", () => {
    const own = { ...product, preorderOwn: ['limit'] }
    expect(resolvePreorderSettings(own, { limit: 7 }, campaign).limit).toBe(7)
    expect(resolvePreorderSettings(own, null, campaign).limit).toBe(3)
  })

  it("falls back to the product's label when the campaign has no button text", () => {
    const blank = { ...campaign, content: {} }
    expect(resolvePreorderSettings(product, null, blank).buttonLabel).toBe('Reserve')
  })

  it('still lets a variant say no to pre-order', () => {
    expect(resolvePreorderSettings(product, { enabled: false }, campaign).enabled).toBe(false)
  })

  it('ignores unknown own fields', () => {
    expect(ownFields(['limit', 'colour', 'note'])).toEqual(['limit', 'note'])
  })
})

describe('campaignApplies', () => {
  it('needs the campaign active and the channel on', () => {
    expect(campaignApplies(campaign, { channel: 'online_store', marketId: null })).toBe(true)
    expect(
      campaignApplies(
        { ...campaign, status: 'paused' },
        { channel: 'online_store', marketId: null },
      ),
    ).toBe(false)
    expect(
      campaignApplies(
        { ...campaign, channels: ['social'] },
        { channel: 'online_store', marketId: null },
      ),
    ).toBe(false)
    expect(campaignApplies(null, { channel: 'online_store' })).toBe(false)
  })

  it('limits to its markets; a cart without a market is in the primary one', () => {
    const india = { ...campaign, marketIds: ['m-in'] }
    expect(campaignApplies(india, { channel: 'online_store', marketId: 'm-in' })).toBe(true)
    expect(campaignApplies(india, { channel: 'online_store', marketId: 'm-ae' })).toBe(false)
    expect(
      campaignApplies(india, { channel: 'online_store', marketId: null, primaryMarketId: 'm-in' }),
    ).toBe(true)
    expect(campaignApplies(india, { channel: 'online_store', marketId: null })).toBe(false)
  })

  it('leaves the market out when the caller does not know it', () => {
    const india = { ...campaign, marketIds: ['m-in'] }
    expect(campaignApplies(india, { channel: 'online_store', marketId: undefined })).toBe(true)
  })
})

describe('preorderUnitPrice', () => {
  it('takes a percent off, rounded to the minor unit', () => {
    expect(preorderUnitPrice(99_999, campaign)).toBe(89_999)
  })

  it('takes a fixed amount off, never below zero', () => {
    expect(preorderUnitPrice(50_000, { discountType: 'fixed', discountValue: 5_000 })).toBe(45_000)
    expect(preorderUnitPrice(3_000, { discountType: 'fixed', discountValue: 5_000 })).toBe(0)
  })

  it('caps a percent at 90', () => {
    expect(preorderUnitPrice(10_000, { discountType: 'percentage', discountValue: 100 })).toBe(
      1_000,
    )
  })

  it('changes nothing without a discount', () => {
    expect(preorderUnitPrice(10_000, { discountType: 'none', discountValue: 10 })).toBe(10_000)
    expect(preorderUnitPrice(10_000, null)).toBe(10_000)
  })
})

describe('campaignLineIsPreorder', () => {
  it('is a pre-order only when the stock cannot cover the line', () => {
    expect(campaignLineIsPreorder({ tracked: true, available: 0, quantity: 1 })).toBe(true)
    expect(campaignLineIsPreorder({ tracked: true, available: 2, quantity: 3 })).toBe(true)
    expect(campaignLineIsPreorder({ tracked: true, available: 3, quantity: 3 })).toBe(false)
    expect(campaignLineIsPreorder({ tracked: false, available: 0, quantity: 5 })).toBe(false)
  })
})

describe('soldOutInCartOutcome', () => {
  it('keeps a pre-order a pre-order', () => {
    expect(soldOutInCartOutcome({ wasPreorder: true, soldOut: false, rule: 'block' })).toBe(
      'preorder',
    )
  })

  it('keeps a line that still has stock', () => {
    expect(soldOutInCartOutcome({ wasPreorder: false, soldOut: false, rule: 'block' })).toBe('keep')
  })

  it('turns a sold-out line into a pre-order, or blocks it, by the rule', () => {
    expect(soldOutInCartOutcome({ wasPreorder: false, soldOut: true, rule: 'preorder' })).toBe(
      'preorder',
    )
    expect(soldOutInCartOutcome({ wasPreorder: false, soldOut: true, rule: 'block' })).toBe('block')
  })
})

describe('mixedCartVerdict', () => {
  const pre = (mixedCart: 'split' | 'together' | 'block' | null) => ({
    preorder: true,
    mixedCart,
    blockMessage: 'Check out pre-orders on their own',
    campaignName: 'Launch',
  })
  const stock = { preorder: false, mixedCart: null }

  it('lets a cart of only pre-orders or only stock through', () => {
    expect(mixedCartVerdict([pre('block'), pre('block')])).toEqual({
      kind: 'ok',
      holdTogether: false,
    })
    expect(mixedCartVerdict([stock, stock])).toEqual({ kind: 'ok', holdTogether: false })
  })

  it('blocks a mix when a campaign says so, with its words', () => {
    expect(mixedCartVerdict([pre('block'), stock])).toEqual({
      kind: 'blocked',
      message: 'Check out pre-orders on their own',
      campaignName: 'Launch',
    })
  })

  it('holds the order together when a campaign says so', () => {
    expect(mixedCartVerdict([pre('together'), stock])).toEqual({ kind: 'ok', holdTogether: true })
  })

  it('takes the strictest rule among the pre-orders', () => {
    expect(mixedCartVerdict([pre('split'), pre('together'), stock]).kind).toBe('ok')
    expect(mixedCartVerdict([pre('split'), pre('block'), stock]).kind).toBe('blocked')
  })

  it('splits pre-orders outside campaigns, and leaves gift cards out', () => {
    expect(mixedCartVerdict([pre(null), stock])).toEqual({ kind: 'ok', holdTogether: false })
    expect(
      mixedCartVerdict([pre('block'), { preorder: false, mixedCart: null, giftCard: true }]),
    ).toEqual({ kind: 'ok', holdTogether: false })
  })
})

describe('campaignNoteSource', () => {
  it("uses the campaign's text for each place", () => {
    expect(campaignNoteSource({ productNote: 'Own', own: [], campaign, place: 'order' })).toBe(
      'Ships {ship_date}',
    )
  })

  it("falls back to the product's note where the campaign has none", () => {
    expect(campaignNoteSource({ productNote: 'Own', own: [], campaign, place: 'cart' })).toBe('Own')
  })

  it("keeps the product's note when it marks the note its own", () => {
    expect(
      campaignNoteSource({ productNote: 'Own', own: ['note'], campaign, place: 'order' }),
    ).toBe('Own')
  })
})

describe('campaignColours', () => {
  it('keeps hex colours and drops anything else', () => {
    expect(
      campaignColours({
        buttonBackground: '#112233',
        buttonText: 'red; background: url(x)',
        badgeBackground: '#abc',
      }),
    ).toEqual({
      buttonBackground: '#112233',
      buttonText: null,
      badgeBackground: '#abc',
      badgeText: null,
    })
  })
})

describe('campaign schemas', () => {
  it('needs a deposit amount for a fixed deposit and a value for a discount', () => {
    expect(
      PreorderCampaignCreateSchema.safeParse({ name: 'X', paymentMode: 'fixed' }).success,
    ).toBe(false)
    expect(
      PreorderCampaignCreateSchema.safeParse({ name: 'X', discountType: 'percentage' }).success,
    ).toBe(false)
    expect(
      PreorderCampaignCreateSchema.safeParse({
        name: 'X',
        discountType: 'percentage',
        discountValue: 95,
      }).success,
    ).toBe(false)
  })

  it('fills the defaults', () => {
    const parsed = PreorderCampaignCreateSchema.parse({ name: 'Launch' })
    expect(parsed.mixedCart).toBe('split')
    expect(parsed.soldOutInCart).toBe('preorder')
    expect(parsed.channels).toEqual(['online_store', 'social', 'ai_agents'])
  })

  it('refuses a colour that is not hex, and reads a blank one as none', () => {
    const base = { id: '0190f0f0-0000-7000-8000-000000000000' }
    expect(
      PreorderCampaignUpdateSchema.safeParse({ ...base, design: { buttonText: 'red' } }).success,
    ).toBe(false)
    const blank = PreorderCampaignUpdateSchema.parse({ ...base, design: { buttonText: '' } })
    expect(blank.design?.buttonText).toBeUndefined()
  })
})
