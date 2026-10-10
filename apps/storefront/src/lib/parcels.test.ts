import { describe, expect, it } from 'vitest'
import { itemTitle, parcelFrom, shopperParcels } from './parcels'

const view = (over: Partial<Parameters<typeof shopperParcels>[0][number]> = {}) => ({
  id: 'fo1',
  position: 1,
  status: 'open' as const,
  needsTransfer: false,
  locationId: 'loc1',
  locationName: 'Delhi warehouse',
  city: 'New Delhi',
  stateCode: 'DL',
  stateName: 'Delhi',
  gstin: null,
  totalPaise: 100,
  deliveryEstimate: { earliest: '2026-10-13', latest: '2026-10-14' },
  lines: [
    { orderLineId: 'l1', title: 'Kurta', variantTitle: 'M', quantity: 2, fulfilledQuantity: 0 },
  ],
  ...over,
})

describe('shopperParcels', () => {
  it('says where each parcel comes from, what is in it and when it arrives', () => {
    const [p] = shopperParcels([view()])
    expect(p).toMatchObject({
      from: 'New Delhi, Delhi',
      items: [{ title: 'Kurta / M', quantity: 2 }],
      onHold: false,
      estimate: { earliest: '2026-10-13', latest: '2026-10-14' },
    })
    expect(p?.dateRange).toContain('13')
  })

  it('leaves out cancelled parcels and says when a pre-order waits', () => {
    const out = shopperParcels([
      view({ status: 'cancelled' }),
      view({ id: 'fo2', status: 'on_hold', deliveryEstimate: null }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ onHold: true, dateRange: null })
  })

  it('names the warehouse when it has no city or state, and drops placeholder variants', () => {
    expect(parcelFrom({ city: null, stateName: null, locationName: 'Main' })).toBe('Main')
    expect(itemTitle('Cap', 'Default')).toBe('Cap')
    expect(itemTitle('Cap', 'Default Title')).toBe('Cap')
  })
})
