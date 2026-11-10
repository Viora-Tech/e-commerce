/** SOURCE OF TRUTH: Shipments tabs tests — WHAT: tab to status mapping / WHY: API list/counts and admin tabs must agree */
import { describe, expect, it } from 'vitest'
import {
  SHIPMENT_TAB_ON_PICKUP,
  SHIPMENT_TAB_STATUSES,
  SHIPMENT_TABS,
  type ShipmentStatus,
} from './tabs'

describe('SHIPMENT_TAB_STATUSES', () => {
  it('puts every live status in exactly one tab, and leaves cancelled out', () => {
    const all: ShipmentStatus[] = [
      'created',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'rto',
    ]
    const listed = Object.values(SHIPMENT_TAB_STATUSES).flat()
    expect([...new Set(listed)].sort()).toEqual([...all].sort())
    // `created` is split by pickup: Booked has none yet, To be picked up has one.
    expect(listed.filter((s) => s === 'created')).toHaveLength(2)
    expect(SHIPMENT_TAB_ON_PICKUP).toEqual({ booked: false, toPickUp: true })
    expect(listed).not.toContain('cancelled')
  })

  it('has a status list for every tab but To book (orders, not shipments)', () => {
    expect(SHIPMENT_TABS.filter((t) => t !== 'toBook').sort()).toEqual(
      Object.keys(SHIPMENT_TAB_STATUSES).sort(),
    )
  })
})
