import { describe, expect, it } from 'vitest'
import { cardPreorder, cheapestPriced } from './catalog'

describe('cheapestPriced (the card price)', () => {
  it('skips variants without a price and is null when none has one (#913)', () => {
    expect(
      cheapestPriced([{ pricePaise: null }, { pricePaise: 900 }, { pricePaise: 500 }]),
    ).toEqual({ pricePaise: 500 })
    expect(cheapestPriced([{ pricePaise: null }])).toBeNull()
  })
})

const product = (over: Partial<Parameters<typeof cardPreorder>[0]> = {}) => ({
  launchAt: null,
  preorderEnabled: true,
  preorderShipDate: null,
  preorderShipsInDays: null,
  preorderLimit: null,
  preorderButtonLabel: 'Pre-order',
  preorderPaymentMode: 'full' as const,
  preorderDepositPaise: null,
  preorderDepositPercent: null,
  ...over,
})

const variant = (onHand: number, reserved = 0, preorderOverride = null) => ({
  onHand,
  reserved,
  trackInventory: true,
  preorderOverride,
})

describe('cardPreorder (the product page rule, on cards)', () => {
  it('is a pre-order when stock ran out and pre-order is on', () => {
    expect(cardPreorder(product(), [variant(0)])).toEqual({ buttonLabel: 'Pre-order' })
  })

  it('is not one while any variant still has stock', () => {
    expect(cardPreorder(product(), [variant(0), variant(3)])).toBeNull()
  })

  it('is sold out with pre-order off, before launch, or with the pre-order limit reached', () => {
    expect(cardPreorder(product({ preorderEnabled: false }), [variant(0)])).toBeNull()
    expect(
      cardPreorder(product({ launchAt: new Date(Date.now() + 86_400_000) }), [variant(0)]),
    ).toBeNull()
    expect(cardPreorder(product({ preorderLimit: 2 }), [variant(0, 2)])).toBeNull()
  })

  it("uses the variant's own label, and its switch only narrows the product's (#962)", () => {
    const label = { buttonLabel: 'Reserve now' }
    expect(cardPreorder(product(), [{ ...variant(0), preorderOverride: label }])).toEqual({
      buttonLabel: 'Reserve now',
    })
    const on = { enabled: true }
    expect(
      cardPreorder(product({ preorderEnabled: false }), [{ ...variant(0), preorderOverride: on }]),
    ).toBeNull()
    const off = { enabled: false }
    expect(cardPreorder(product(), [{ ...variant(0), preorderOverride: off }])).toBeNull()
  })
})
