import { sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { orderAmounts } from '../src/amounts'
import { scheduleRapidshypPickups } from '../src/pickup'
import { RapidshypProvider } from '../src/rapidshyp'

const config = {
  apiKey: 'rs-test-key',
  storeName: 'DEFAULT',
  pickupAddressName: 'Waimers Sonipat',
  originPincode: '131028',
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

/** What RapidShyp collects from these fields (docs: Create Order, B2C Wrapper API). */
const collectable = (
  items: { unitPrice: number; units: number }[],
  a: ReturnType<typeof orderAmounts>,
) =>
  Math.round(
    (items.reduce((s, i) => s + i.unitPrice * i.units, 0) +
      a.shippingCharges +
      a.codCharges -
      a.totalDiscount -
      a.prepaidAmount) *
      100,
  )

const lines = [
  { title: 'Mousepad', quantity: 2, unitPricePaise: 99900 },
  { title: 'Keycaps', quantity: 1, unitPricePaise: 50000 },
]
const items = lines.map((l) => ({ unitPrice: l.unitPricePaise / 100, units: l.quantity }))

describe('orderAmounts: RapidShyp collects what the admin shows', () => {
  it('a coupon goes as totalDiscount', () => {
    const a = orderAmounts({
      lines,
      paymentMode: 'cod',
      codAmountPaise: 219800,
      valuePaise: 219800,
    })
    expect(a).toEqual({
      shippingCharges: 0,
      totalDiscount: 30000 / 100,
      codCharges: 0,
      prepaidAmount: 0,
    })
    expect(collectable(items, a)).toBe(219800)
  })

  it('a shipping fee goes as shippingCharges', () => {
    const a = orderAmounts({
      lines,
      paymentMode: 'cod',
      codAmountPaise: 264800,
      valuePaise: 264800,
    })
    expect(a.shippingCharges).toBe(150)
    expect(collectable(items, a)).toBe(264800)
  })

  it('a collect amount below the value goes as prepaidAmount, above it as codCharges', () => {
    const part = orderAmounts({
      lines,
      paymentMode: 'cod',
      codAmountPaise: 100000,
      valuePaise: 249800,
    })
    expect(part.prepaidAmount).toBe(1498)
    expect(collectable(items, part)).toBe(100000)
    const fee = orderAmounts({
      lines,
      paymentMode: 'cod',
      codAmountPaise: 254800,
      valuePaise: 249800,
    })
    expect(fee.codCharges).toBe(50)
    expect(collectable(items, fee)).toBe(254800)
  })

  it('a prepaid order sends nothing to collect', () => {
    const a = orderAmounts({ lines, paymentMode: 'prepaid', codAmountPaise: 0, valuePaise: 219800 })
    expect(a).toMatchObject({ codCharges: 0, prepaidAmount: 0, totalDiscount: 300 })
  })

  it('goes on the create_order body', async () => {
    let body: Record<string, unknown> = {}
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.includes('/create_order')) {
        body = JSON.parse(init?.body as string)
        return json({ status: 'SUCCESS', order_id: '1', shipment: [{ shipmentId: 'S1' }] })
      }
      return json({})
    }
    const p = new RapidshypProvider({ ...config, fetchImpl })
    await p.pushOrder({
      ...sampleShipment,
      lines,
      paymentMode: 'cod',
      codAmountPaise: 219800,
      valuePaise: 219800,
    })
    expect(body).toMatchObject({ paymentMethod: 'COD', totalDiscount: 300, shippingCharges: 0 })
  })
})

describe('Create pickup for a RapidShyp parcel with no pickup', () => {
  it('finds each shipment by AWB and asks its pickup', async () => {
    const asked: string[][] = []
    const r = await scheduleRapidshypPickups(
      {
        provider: 'rapidshyp',
        shipmentIdOf: async (awb) => `S-${awb}`,
        schedulePickup: async (id, awb) => {
          asked.push([id, awb])
          return { status: 'SUCCESS' }
        },
      },
      {
        parcels: [
          { waybill: 'A1', providerRef: '2471' },
          { waybill: 'A2', providerRef: null },
        ],
      },
    )
    expect(asked).toEqual([
      ['S-A1', 'A1'],
      ['S-A2', 'A2'],
    ])
    expect(r.providerPickupId).toBe('A1, A2')
  })

  it('throws RapidShyp’s remark when it refuses, naming the parcels it did take', async () => {
    await expect(
      scheduleRapidshypPickups(
        {
          provider: 'rapidshyp',
          shipmentIdOf: async (awb) => `S-${awb}`,
          schedulePickup: async (_id, awb) =>
            awb === 'A1' ? { status: 'SUCCESS' } : { status: 'FAILED', remarks: 'Pickup closed' },
        },
        {
          parcels: [
            { waybill: 'A1', providerRef: null },
            { waybill: 'A2', providerRef: null },
          ],
        },
      ),
    ).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringMatching(/Pickup closed.*A1/),
    })
  })

  it('reads the shipment id from Track Order by AWB, over the provider', async () => {
    const calls: { path: string; body: unknown }[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input))
      calls.push({ path: url.pathname, body: JSON.parse(init?.body as string) })
      if (url.pathname.endsWith('/track_order'))
        return json({
          success: true,
          records: [{ shipment_details: [{ shipment_id: 'SX', awb: 'AWB9' }] }],
        })
      return json({ status: 'SUCCESS' })
    }
    const p = new RapidshypProvider({ ...config, fetchImpl })
    expect(p.pickupPerParcel).toBe(true)
    await p.schedulePickup({
      pickupLocationName: 'Waimers Sonipat',
      date: '2026-11-23',
      timeFrom: '14:00',
      expectedPackageCount: 1,
      parcels: [{ waybill: 'AWB9', providerRef: '2471' }],
    })
    expect(calls.map((c) => c.path.split('/').pop())).toEqual(['track_order', 'schedule_pickup'])
    expect(calls[1]?.body).toEqual({ shipment_id: 'SX', awb: 'AWB9' })
  })
})
