/** SOURCE OF TRUTH: parcel cost tests — WHAT: packing and delivery estimates per parcel / WHY: guards the floor profit */
import { describe, expect, it } from 'vitest'
import {
  buildDeliveryRates,
  DEFAULT_DELIVERY_PAISE,
  estimateDelivery,
  type ParcelFacts,
  type ParcelOrderContext,
  type ParcelShipment,
  parcelCost,
} from './profit-estimates'

const rates = buildDeliveryRates([
  { provider: 'delhivery', stateCode: 'HR', chargePaise: 6_000 },
  { provider: 'delhivery', stateCode: 'HR', chargePaise: 8_500 },
  { provider: 'shiprocket', stateCode: 'HR', chargePaise: 9_000 },
  { provider: 'delhivery', stateCode: 'MH', chargePaise: 7_000 },
  { provider: 'delhivery', stateCode: null, chargePaise: 99_000 },
])

const ctx = (over: Partial<ParcelOrderContext> = {}): ParcelOrderContext => ({
  orderCancelled: false,
  shipsToAddress: true,
  stateCode: 'HR',
  defaultCourier: 'delhivery',
  rates,
  defaultDeliveryPaise: DEFAULT_DELIVERY_PAISE,
  ...over,
})

const parcel = (over: Partial<ParcelFacts> = {}): ParcelFacts => ({
  shippable: true,
  cancelled: false,
  boxCostPaise: 800,
  shipments: [],
  ...over,
})

const booked = (over: Partial<ParcelShipment> = {}): ParcelShipment => ({
  provider: 'delhivery',
  cancelled: false,
  courierChargePaise: null,
  packingCostPaise: null,
  ...over,
})

describe('estimateDelivery', () => {
  it('takes the highest real charge for that courier and state', () => {
    expect(estimateDelivery(rates, 'delhivery', 'HR', 10_000)).toBe(8_500)
    expect(estimateDelivery(rates, 'delhivery', 'hr', 10_000)).toBe(8_500)
  })

  it('any courier when none is known yet, else the store default', () => {
    expect(estimateDelivery(rates, null, 'HR', 10_000)).toBe(9_000)
    expect(estimateDelivery(rates, 'bluedart', 'HR', 10_000)).toBe(10_000)
    expect(estimateDelivery(rates, 'delhivery', 'KA', 12_000)).toBe(12_000)
    expect(estimateDelivery(rates, 'delhivery', null, 10_000)).toBe(10_000)
  })
})

describe('parcelCost', () => {
  it('a parcel not booked yet: box cost now and the cautious delivery, both estimated', () => {
    expect(parcelCost(parcel(), ctx())).toEqual({
      packingPaise: 800,
      packingEstimated: true,
      packingMissing: false,
      courierPaise: 8_500,
      courierEstimated: true,
    })
  })

  it('a booked parcel uses its snapshot and the real charge', () => {
    const cost = parcelCost(
      parcel({
        boxCostPaise: 1_500,
        shipments: [booked({ courierChargePaise: 6_500, packingCostPaise: 800 })],
      }),
      ctx(),
    )
    expect(cost).toEqual({
      packingPaise: 800,
      packingEstimated: false,
      packingMissing: false,
      courierPaise: 6_500,
      courierEstimated: false,
    })
  })

  it('a booking with no charge yet is estimated for its own courier', () => {
    const cost = parcelCost(parcel({ shipments: [booked({ provider: 'shiprocket' })] }), ctx())
    expect(cost).toMatchObject({ courierPaise: 9_000, courierEstimated: true })
  })

  it('no box cost: packing counts nothing and is flagged', () => {
    expect(parcelCost(parcel({ boxCostPaise: null }), ctx())).toMatchObject({
      packingPaise: 0,
      packingEstimated: false,
      packingMissing: true,
    })
  })

  it('nothing for gift cards, cancelled parcels, unbooked cancelled orders or no address', () => {
    expect(parcelCost(parcel({ shippable: false }), ctx())).toBeNull()
    expect(parcelCost(parcel({ cancelled: true }), ctx())).toBeNull()
    expect(parcelCost(parcel(), ctx({ orderCancelled: true }))).toBeNull()
    expect(parcelCost(parcel(), ctx({ shipsToAddress: false }))).toBeNull()
  })

  it('a cancelled consignment keeps its packing; its charge does not count', () => {
    const cost = parcelCost(
      parcel({
        shipments: [booked({ cancelled: true, courierChargePaise: 6_000, packingCostPaise: 800 })],
      }),
      ctx({ orderCancelled: true }),
    )
    expect(cost).toEqual({
      packingPaise: 800,
      packingEstimated: false,
      packingMissing: false,
      courierPaise: 0,
      courierEstimated: false,
    })
  })

  it('a re-booked parcel counts its live consignment and the latest snapshot', () => {
    const cost = parcelCost(
      parcel({
        shipments: [
          booked({ cancelled: true, courierChargePaise: 6_000, packingCostPaise: 800 }),
          booked({ courierChargePaise: 7_000, packingCostPaise: 900 }),
        ],
      }),
      ctx(),
    )
    expect(cost).toMatchObject({ packingPaise: 900, courierPaise: 7_000, courierEstimated: false })
  })
})
