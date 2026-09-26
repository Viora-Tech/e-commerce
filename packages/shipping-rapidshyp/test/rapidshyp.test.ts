import { CourierError } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { mapRapidshypStatus, RapidshypProvider, rapidshypFactory } from '../src/rapidshyp'

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** A fetch that records every call and answers from a route table. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: URL; init?: RequestInit | undefined }[] = []
  const impl: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    calls.push({ url, init })
    const route = Object.entries(routes).find(([path]) => url.pathname.startsWith(path))?.[1]
    if (!route) return new Response('not found', { status: 404 })
    return route(url, init)
  }
  return { impl, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const config = {
  apiKey: 'rs-test-key',
  storeName: 'DEFAULT',
  pickupAddressName: 'Waimers Sonipat',
  originPincode: '131028',
}

describe('RapidshypProvider serviceability and rates', () => {
  it('reports serviceable with the widest transit range, and checks COD with a second call', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': (_url, init) => {
        const body = JSON.parse((init?.body as string) ?? '{}')
        const codList = body.cod
          ? [
              {
                courier_code: 'B',
                courier_name: 'Courier B',
                total_freight: 90,
                edd: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
              },
            ]
          : [
              {
                courier_code: 'A',
                courier_name: 'Courier A',
                total_freight: 60,
                edd: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
              },
              {
                courier_code: 'B',
                courier_name: 'Courier B',
                total_freight: 90,
                edd: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
              },
            ]
        return json({ status: true, serviceable_courier_list: codList })
      },
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({
      serviceable: true,
      codAvailable: true,
      minTransitDays: 3,
      maxTransitDays: 5,
    })
    const calls = f.calls.filter((c) => c.url.pathname.endsWith('/serviceabilty_check'))
    expect(calls).toHaveLength(2)
  })

  it('is unserviceable, not an error, when no couriers are returned', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': () =>
        json({ status: true, serviceable_courier_list: [] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '744101' })
    expect(r.serviceable).toBe(false)
  })

  it('quoteRate returns the cheapest courier', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': () =>
        json({
          status: true,
          serviceable_courier_list: [
            { courier_code: 'A', total_freight: 90, edd: '2026-10-01' },
            { courier_code: 'B', total_freight: 60, edd: '2026-09-30' },
          ],
        }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.quoteRate({
      originPincode: '131028',
      destinationPincode: '560001',
      weightGrams: 500,
      declaredValuePaise: 199900,
      paymentMode: 'prepaid',
    })
    expect(r).toMatchObject({ pricePaise: 6000 })
  })

  it('listCourierOptions returns every serviceable courier with COD flagged per courier', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': (_url, init) => {
        const body = JSON.parse((init?.body as string) ?? '{}')
        const list = body.cod
          ? [{ courier_code: 'B', courier_name: 'Xpressbees', total_freight: 90 }]
          : [
              { courier_code: 'A', courier_name: 'Delhivery', total_freight: 60 },
              { courier_code: 'B', courier_name: 'Xpressbees', total_freight: 90 },
            ]
        return json({ status: true, serviceable_courier_list: list })
      },
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const options = await p.listCourierOptions({
      originPincode: '131028',
      destinationPincode: '560001',
      weightGrams: 500,
      declaredValuePaise: 199900,
      paymentMode: 'prepaid',
    })
    expect(options).toHaveLength(2)
    expect(options.find((o) => o.courierId === 'A')).toMatchObject({ codAvailable: false })
    expect(options.find((o) => o.courierId === 'B')).toMatchObject({ codAvailable: true })
  })

  it('maps a rejected/auth API key to an auth CourierError', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': () => new Response('', { status: 401 }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(
      p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' }),
    ).rejects.toMatchObject({ kind: 'auth' })
    expect((await p.verifyCredentials()).ok).toBe(false)
  })
})

describe('RapidshypProvider createShipment (wrapper API)', () => {
  it('creates an order via the wrapper and reads AWB + label + pickup off one response', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/wrapper': () =>
        json({
          status: 'SUCCESS',
          orderId: 'ord-1',
          orderCreated: true,
          shipment: [
            {
              shipmentId: 'ship-1',
              awbGenerated: true,
              labelGenerated: true,
              pickupScheduled: true,
              awb: 'RS999',
              labelURL: 'https://labels/ship-1.pdf',
            },
          ],
        }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      paymentMode: 'prepaid',
      codAmountPaise: 0,
    })
    expect(r).toMatchObject({
      waybill: 'RS999',
      providerRef: 'ord-1',
      labelUrl: 'https://labels/ship-1.pdf',
    })

    const call = f.calls.find((c) => c.url.pathname.endsWith('/wrapper'))
    const body = JSON.parse(call?.init?.body as string)
    expect(body).toMatchObject({
      pickupAddressName: 'Waimers Sonipat',
      storeName: 'DEFAULT',
      paymentMethod: 'PREPAID',
    })
    expect(body.shippingAddress).toMatchObject({ pinCode: sampleShipment.to.pincode })
  })

  it('falls back to assign_awb when the wrapper did not assign a courier', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/wrapper': () =>
        json({
          status: 'SUCCESS',
          orderId: 'ord-2',
          orderCreated: true,
          shipment: [{ shipmentId: 'ship-2', awbGenerated: false, pickupScheduled: false }],
        }),
      '/rapidshyp/apis/v1/assign_awb': () => json({ status: 'SUCCESS', awb: 'RS888' }),
      '/rapidshyp/apis/v1/schedule_pickup': () => json({ status: 'SUCCESS', awb: 'RS888' }),
      '/rapidshyp/apis/v1/generate_label': () =>
        json({ status: true, labelData: [{ shipmentId: 'ship-2', labelURL: 'https://l/2.pdf' }] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment(sampleShipment)
    expect(r).toMatchObject({ waybill: 'RS888', labelUrl: 'https://l/2.pdf' })
    expect(f.calls.some((c) => c.url.pathname.endsWith('/assign_awb'))).toBe(true)
    expect(f.calls.some((c) => c.url.pathname.endsWith('/schedule_pickup'))).toBe(true)
    expect(f.calls.some((c) => c.url.pathname.endsWith('/generate_label'))).toBe(true)
  })

  it('surfaces a rejected order', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/wrapper': () =>
        json({ status: 'FAILED', orderCreated: false, remarks: 'Invalid pincode' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('Invalid pincode'),
    })
  })

  it('rejects when the wrapper and the assign_awb fallback both fail to produce an AWB', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/wrapper': () =>
        json({
          status: 'SUCCESS',
          orderId: 'ord-3',
          orderCreated: true,
          shipment: [{ shipmentId: 'ship-3', awbGenerated: false }],
        }),
      '/rapidshyp/apis/v1/assign_awb': () => json({ status: 'FAILED', remarks: 'no courier' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({ kind: 'rejected' })
  })
})

describe('RapidshypProvider cancel', () => {
  it('cancels by the RapidShyp order id (providerRef), not the AWB', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/cancel_order': () => json({ status: true, remarks: 'cancelled' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('ord-1')).resolves.toBeUndefined()
    const call = f.calls.find((c) => c.url.pathname.endsWith('/cancel_order'))
    const body = JSON.parse(call?.init?.body as string)
    expect(body).toMatchObject({ orderId: 'ord-1', storeName: 'DEFAULT' })
  })

  it('throws rejected when RapidShyp declines the cancellation', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/cancel_order': () => json({ status: false, remarks: 'already shipped' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('ord-1')).rejects.toMatchObject({ kind: 'rejected' })
  })
})

describe('mapRapidshypStatus', () => {
  it('maps tracking status codes', () => {
    expect(mapRapidshypStatus('DEL', undefined)).toBe('delivered')
    expect(mapRapidshypStatus('RTO_DEL', undefined)).toBe('rto')
    expect(mapRapidshypStatus('CAN', undefined)).toBe('cancelled')
    expect(mapRapidshypStatus('OFD', undefined)).toBe('out_for_delivery')
    expect(mapRapidshypStatus('PUC', undefined)).toBe('picked_up')
    expect(mapRapidshypStatus('SCB', undefined)).toBe('created')
    expect(mapRapidshypStatus('INT', undefined)).toBe('in_transit')
  })

  it('falls back to the coarse shipment_status text when there is no code', () => {
    expect(mapRapidshypStatus(undefined, 'DELIVERED')).toBe('delivered')
    expect(mapRapidshypStatus(undefined, 'READY_TO_SHIP')).toBe('created')
    expect(mapRapidshypStatus(undefined, 'something unrecognised')).toBe('in_transit')
  })
})

describe('RapidshypProvider track', () => {
  it('maps a delivered scan and builds events from track_scans', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/track_order': () =>
        json({
          success: true,
          records: [
            {
              shipment_details: [
                {
                  awb: 'RS999',
                  shipment_status: 'DELIVERED',
                  current_tracking_status_code: 'DEL',
                  current_tracking_status_desc: 'Delivered',
                  current_status_date: '2026-09-20 10:00:00',
                  track_scans: [
                    { status_code: 'PUC', status_description: 'Picked up', date: '2026-09-18' },
                    { status_code: 'DEL', status_description: 'Delivered', date: '2026-09-20' },
                  ],
                },
              ],
            },
          ],
        }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const t = await p.track('RS999')
    expect(t.status).toBe('delivered')
    expect(t.events).toHaveLength(2)
    expect(t.events[0]?.status).toBe('picked_up')
    expect(t.events[1]?.status).toBe('delivered')
  })

  it('maps an undelivered scan so the shared NDR detector picks it up', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/track_order': () =>
        json({
          success: true,
          records: [
            {
              shipment_details: [
                {
                  awb: 'RS999',
                  shipment_status: 'IN_TRANSIT',
                  current_tracking_status_code: 'UND',
                  current_tracking_status_desc: 'Undelivered - consignee not available',
                  current_status_date: '2026-09-19',
                  track_scans: [],
                },
              ],
            },
          ],
        }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const t = await p.track('RS999')
    expect(t.status).toBe('in_transit')
    expect(t.events[0]?.description.toLowerCase()).toContain('undelivered')
  })

  it('maps an RTO code to rto', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/track_order': () =>
        json({
          success: true,
          records: [
            {
              shipment_details: [
                {
                  awb: 'RS999',
                  shipment_status: 'RTO',
                  current_tracking_status_code: 'RTO_DEL',
                  track_scans: [],
                },
              ],
            },
          ],
        }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const t = await p.track('RS999')
    expect(t.status).toBe('rto')
  })

  it('throws bad_response when RapidShyp has no record of the AWB', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/track_order': () => json({ success: false, records: [] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.track('RS999')).rejects.toMatchObject({ kind: 'bad_response' })
  })
})

describe('RapidshypProvider ndrAction', () => {
  it('reattempts with an updated address/phone', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/ndr/action': () => json({ status: 'SUCCESS', remarks: 'ok' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.ndrAction({
      waybill: 'RS999',
      action: 'reattempt',
      phone: '9999999999',
      address: 'New address',
    })
    expect(r.accepted).toBe(true)
    const call = f.calls.find((c) => c.url.pathname.endsWith('/ndr/action'))
    const body = JSON.parse(call?.init?.body as string)
    expect(body).toMatchObject({ awb: 'RS999', action: 'REATTEMPT', address1: 'New address' })
  })

  it('maps rto to RETURN', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/ndr/action': () => json({ status: 'SUCCESS' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await p.ndrAction({ waybill: 'RS999', action: 'rto' })
    const call = f.calls.find((c) => c.url.pathname.endsWith('/ndr/action'))
    const body = JSON.parse(call?.init?.body as string)
    expect(body.action).toBe('RETURN')
  })

  it('throws rejected when RapidShyp declines the NDR action', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/ndr/action': () => json({ status: 'FAILED', remarks: 'window expired' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.ndrAction({ waybill: 'RS999', action: 'reattempt' })).rejects.toMatchObject({
      kind: 'rejected',
    })
  })
})

describe('RapidshypProvider createReturnPickup', () => {
  it('books a reverse pickup: serviceability -> create_return -> return_schedule_pickup', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': (_url, init) => {
        const body = JSON.parse((init?.body as string) ?? '{}')
        expect(body.is_return).toBe(true)
        return json({
          status: true,
          serviceable_courier_list: [{ courier_code: 'RC1', courier_name: 'Delhivery Reverse' }],
        })
      },
      '/rapidshyp/apis/v1/create_return': () =>
        json({ status: 'success', order_id: 'ret-1', shipment: [{ shipment_id: 'rship-1' }] }),
      '/rapidshyp/apis/v1/return_schedule_pickup': () =>
        json({ status: 'SUCCESS', shipmentId: 'rship-1', awb: 'RRS777', courierCode: 'RC1' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createReturnPickup({
      returnId: 'return-1',
      reference: 'R-1-1044',
      orderNumber: 1044,
      from: sampleShipment.to,
      to: sampleShipment.from,
      lines: sampleShipment.lines,
      valuePaise: sampleShipment.valuePaise,
      weightGrams: sampleShipment.weightGrams,
    })
    expect(r).toMatchObject({ waybill: 'RRS777', providerRef: 'rship-1' })
  })

  it('rejects when no courier is serviceable for the return leg', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': () =>
        json({ status: true, serviceable_courier_list: [] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(
      p.createReturnPickup({
        returnId: 'return-1',
        reference: 'R-1-1044',
        orderNumber: 1044,
        from: sampleShipment.to,
        to: sampleShipment.from,
        lines: sampleShipment.lines,
        valuePaise: sampleShipment.valuePaise,
        weightGrams: sampleShipment.weightGrams,
      }),
    ).rejects.toMatchObject({ kind: 'rejected' })
  })
})

describe('RapidshypProvider pickup locations', () => {
  it('lists registered pickup locations, wrapping a single object into an array', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/fetch_pickup_location': () =>
        json({
          pickup_name: 'Waimers Sonipat',
          city: 'Sonipat',
          pin_code: '131028',
          status: 'enabled',
        }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const locations = await p.listPickupLocations()
    expect(locations).toEqual([
      { name: 'Waimers Sonipat', city: 'Sonipat', pincode: '131028', status: 'enabled' },
    ])
  })

  it('creates a pickup location', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create/pickup_location': () =>
        json({ status: 'success', pickup_location_name: 'Warehouse1' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createPickupLocation({
      addressName: 'Warehouse1',
      contactName: 'Cristiano Ronaldo',
      contactNumber: '9999999999',
      addressLine1: '123 Main St',
      pincode: '110001',
    })
    expect(r).toEqual({ pickupLocationName: 'Warehouse1' })
  })
})

describe('rapidshypFactory', () => {
  it('requires an API key, store name, pickup nickname and origin pincode', () => {
    expect(rapidshypFactory.validateConfig({})).toMatchObject({ ok: false })
    const r = rapidshypFactory.validateConfig({ ...config, baseUrl: ' ' })
    expect(r).toMatchObject({ ok: true, config: { apiKey: config.apiKey, baseUrl: undefined } })
  })

  it('rejects a malformed origin pincode', () => {
    const r = rapidshypFactory.validateConfig({ ...config, originPincode: '123' })
    expect(r).toMatchObject({ ok: false })
  })

  it('declares the confirmed capabilities', () => {
    expect(rapidshypFactory.capabilities).toEqual([
      'serviceability',
      'rates',
      'create_shipment',
      'label',
      'tracking',
      'cancel',
      'ndr',
      'reverse_pickup',
    ])
  })
})

describeShippingProvider('rapidshyp (offline)', {
  create: () =>
    new RapidshypProvider({
      ...config,
      fetchImpl: async () => {
        throw new CourierError('unavailable', 'rapidshyp', 'offline')
      },
    }),
})

const live = process.env.RAPIDSHYP_API_KEY
if (live) {
  describeShippingProvider('rapidshyp (live)', {
    live: true,
    create: () =>
      new RapidshypProvider({
        apiKey: live,
        storeName: process.env.RAPIDSHYP_STORE_NAME ?? 'DEFAULT',
        pickupAddressName: process.env.RAPIDSHYP_PICKUP ?? 'Waimers',
        originPincode: process.env.RAPIDSHYP_ORIGIN_PIN ?? '131028',
      }),
  })
}
