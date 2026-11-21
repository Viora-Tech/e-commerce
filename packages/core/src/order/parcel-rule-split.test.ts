/** SOURCE OF TRUTH: an order's parcels split by product rules — WHAT: one location's routed
 * parcel becomes one parcel per saved route naming its variants, each finds its own route and
 * its own fulfilment order id; orders without variant ids are unchanged / WHY: booking makes one
 * label per parcel on the courier picked for it (owner, 21 Nov 2026). Pure. */
import type { OrderDeliveryParcelRoute, OrderDeliveryRoute } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { withParcelIds } from '../shipping/delivery-options/booking'
import { parcelRouteFor, splitByDeliveryRoutes } from './parcel-rule-split'
import type { RoutedParcel } from './routing'

const route = (
  key: string,
  locationId: string,
  variantIds?: string[],
): OrderDeliveryParcelRoute => ({
  locationId,
  onHold: false,
  ...(variantIds ? { variantIds } : {}),
  route: {
    key,
    providerId: key.split(':')[0] ?? key,
    channel: 'aggregator',
    carrier: key,
    serviceId: 'S',
    serviceLabel: 'Surface',
  },
  insured: false,
  insurancePaise: null,
  markupPaise: 0,
  courierCostPaise: 6000,
  promisedEarliest: key === 'bluedart:A' ? '2026-11-24' : '2026-11-26',
  promisedLatest: key === 'bluedart:A' ? '2026-11-25' : '2026-11-27',
})
const delivery = (parcels: OrderDeliveryParcelRoute[]): OrderDeliveryRoute => ({
  optionId: 'std',
  optionName: 'Delivery',
  route: parcels[0]?.route ?? null,
  pickedBy: 'strategy',
  insured: false,
  insurancePaise: null,
  markupPaise: 0,
  courierCostPaise: null,
  promisedEarliest: null,
  promisedLatest: null,
  quoteSource: 'live',
  parcels,
})
/** Lines by index: 0 pad, 1 mouse, 2 cable (no route names it). */
const VARIANTS = ['v-pad', 'v-mouse', 'v-cable']
const variantOf = (key: string) => VARIANTS[Number(key)]
const parcel = (locationId: string, keys: string[]): RoutedParcel => ({
  locationId,
  status: 'open',
  needsTransfer: false,
  lines: keys.map((key) => ({ key, quantity: 1 })),
})

describe('splitByDeliveryRoutes', () => {
  const saved = delivery([
    route('delhivery:S', 'l1', ['v-pad']),
    route('bluedart:A', 'l1', ['v-mouse']),
    route('dtdc:S', 'l2', ['v-other']),
  ])

  it('cuts a location’s parcel into one per route, lines no route names with the first', () => {
    const out = splitByDeliveryRoutes(
      [parcel('l1', ['0', '1', '2']), parcel('l2', ['3'])],
      saved,
      variantOf,
    )
    expect(out.map((p) => [p.locationId, p.lines.map((l) => l.key)])).toEqual([
      ['l1', ['0', '2']],
      ['l1', ['1']],
      ['l2', ['3']],
    ])
    expect(parcelRouteFor(saved, out[1] as RoutedParcel, variantOf)?.route?.key).toBe('bluedart:A')
    expect(parcelRouteFor(saved, out[0] as RoutedParcel, variantOf)?.promisedLatest).toBe(
      '2026-11-27',
    )
  })

  it('leaves orders saved without variant ids, and one route per location, as they were', () => {
    const old = delivery([route('delhivery:S', 'l1'), route('bluedart:A', 'l2')])
    const parcels = [parcel('l1', ['0', '1']), parcel('l2', ['2'])]
    expect(splitByDeliveryRoutes(parcels, old, variantOf)).toEqual(parcels)
    expect(splitByDeliveryRoutes(parcels, null, variantOf)).toEqual(parcels)
  })

  it('stamps each route with the fulfilment order carrying its variants', () => {
    const stamped = withParcelIds(saved, [
      { id: 'fo-mouse', locationId: 'l1', status: 'open', variantIds: ['v-mouse'] },
      { id: 'fo-pad', locationId: 'l1', status: 'open', variantIds: ['v-pad', 'v-cable'] },
      { id: 'fo-other', locationId: 'l2', status: 'open', variantIds: ['v-other'] },
    ])
    expect(stamped?.parcels?.map((p) => p.fulfillmentOrderId)).toEqual([
      'fo-pad',
      'fo-mouse',
      'fo-other',
    ])
  })
})
