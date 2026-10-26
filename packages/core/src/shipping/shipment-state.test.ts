/** SOURCE OF TRUTH: tests for cancelBlock and shipmentLabelUrl — WHAT: when a cancel is refused and which label links go through the admin route / WHY: pins the rules the server and the admin share */
import { describe, expect, it } from 'vitest'
import { cancelBlock, isKeyedLabelUrl, shipmentLabelUrl, storedLabelUrl } from './shipment-state'

const ok = { inManifest: false, courierCancels: true }

describe('cancelBlock', () => {
  it('allows a booked label that has not left', () => {
    expect(cancelBlock({ status: 'created' }, ok)).toBeNull()
  })

  it('says why not, most final reason first', () => {
    expect(cancelBlock({ status: 'cancelled' }, ok)).toBe('cancelled')
    expect(cancelBlock({ status: 'delivered' }, ok)).toBe('settled')
    expect(cancelBlock({ status: 'rto' }, ok)).toBe('settled')
    for (const status of ['picked_up', 'in_transit', 'out_for_delivery']) {
      expect(cancelBlock({ status }, ok)).toBe('picked_up')
    }
    expect(cancelBlock({ status: 'created' }, { ...ok, inManifest: true })).toBe('in_manifest')
    expect(cancelBlock({ status: 'created' }, { ...ok, courierCancels: false })).toBe(
      'not_supported',
    )
    // Already moving beats "no cancel": the parcel left either way.
    expect(cancelBlock({ status: 'in_transit' }, { inManifest: true, courierCancels: false })).toBe(
      'picked_up',
    )
  })
})

describe('shipmentLabelUrl', () => {
  it('serves a Delhivery packing slip link through the admin route', () => {
    const keyed = 'https://track.delhivery.com/api/p/packing_slip?wbns=123&pdf=true'
    expect(isKeyedLabelUrl(keyed)).toBe(true)
    expect(isKeyedLabelUrl('https://staging-express.delhivery.com/api/p/packing_slip?wbns=1')).toBe(
      true,
    )
    expect(shipmentLabelUrl({ id: 's1', labelUrl: keyed })).toBe(storedLabelUrl('s1'))
  })

  it('keeps every other link as stored', () => {
    expect(shipmentLabelUrl({ id: 's1', labelUrl: null })).toBeNull()
    expect(shipmentLabelUrl({ id: 's1', labelUrl: '/api/shipments/s1/label' })).toBe(
      '/api/shipments/s1/label',
    )
    expect(shipmentLabelUrl({ id: 's1', labelUrl: 'https://shiprocket.co/label.pdf' })).toBe(
      'https://shiprocket.co/label.pdf',
    )
    expect(isKeyedLabelUrl('https://evil.example.com/?u=delhivery.com/api/p/packing_slip')).toBe(
      false,
    )
  })
})
