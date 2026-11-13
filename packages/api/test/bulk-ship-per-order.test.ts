/** The bulk ship drawer's per-order values (Edit popup) and the shopper's delivery choice that
 *  Create shipment shows. Pure: no database. */
import type { OrderShippingSnapshot } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { bookingFor, deliveryChoiceOf } from '../src/services/shipment-choices'

const snapshot = (over: Partial<OrderShippingSnapshot> = {}): OrderShippingSnapshot => ({
  rateId: 'standard',
  rateName: 'Standard',
  zoneId: 'z1',
  zoneName: 'India',
  listPricePaise: 9900,
  pricePaise: 9900,
  codSurchargePaise: null,
  minTransitDays: 3,
  maxTransitDays: 6,
  ...over,
})

describe('bookingFor', () => {
  it("an order's own weight, box, payment and insurance beat the batch's", () => {
    const batch = { weightGrams: 500, dimensionsCm: { length: 10, width: 10, height: 10 } }
    expect(
      bookingFor(batch, {
        weightGrams: 950,
        dimensionsCm: { length: 30, width: 20, height: 10 },
        paymentMode: 'prepaid',
        insured: false,
      }),
    ).toEqual({
      weightGrams: 950,
      dimensionsCm: { length: 30, width: 20, height: 10 },
      paymentMode: 'prepaid',
      insured: false,
    })
  })

  it("an order without its own values books with the batch's, payment left to the order", () => {
    expect(bookingFor({ insured: true }, undefined)).toEqual({
      weightGrams: undefined,
      dimensionsCm: undefined,
      insured: true,
    })
  })
})

describe('deliveryChoiceOf', () => {
  it('is null when the order saved no shipping', () => {
    expect(deliveryChoiceOf(null)).toBeNull()
  })

  it('names the zone rate when no delivery option was saved', () => {
    expect(deliveryChoiceOf(snapshot())).toEqual({
      name: 'Standard',
      pricePaise: 9900,
      route: null,
      providerId: null,
      insured: false,
    })
  })

  it('names the delivery option and the courier route it was priced on', () => {
    const choice = deliveryChoiceOf(
      snapshot({
        delivery: {
          optionId: 'express',
          optionName: 'Express',
          route: {
            key: 'delhivery:E',
            providerId: 'delhivery',
            channel: 'direct',
            carrier: 'Delhivery',
            serviceId: 'E',
            serviceLabel: 'Express',
          },
          pickedBy: 'shopper',
          insured: true,
          insurancePaise: 2500,
          markupPaise: 0,
          courierCostPaise: 7000,
          promisedEarliest: null,
          promisedLatest: null,
          quoteSource: 'live',
        },
      }),
    )
    expect(choice).toEqual({
      name: 'Express',
      pricePaise: 9900,
      route: 'Delhivery Express',
      providerId: 'delhivery',
      insured: true,
    })
  })
})
