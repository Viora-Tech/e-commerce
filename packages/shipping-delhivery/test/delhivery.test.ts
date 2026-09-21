import { CourierError } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { DelhiveryProvider, delhiveryFactory, mapDelhiveryStatus } from '../src/delhivery'

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
  apiToken: 'tok',
  clientName: 'Waimers',
  pickupLocationName: 'Waimers Sonipat',
  originPincode: '131028',
}

describe('DelhiveryProvider', () => {
  it('reports a served pincode with COD and the expected TAT', async () => {
    const f = fakeFetch({
      '/c/api/pin-codes/json/': () =>
        json({ delivery_codes: [{ postal_code: { cod: 'Y', pre_paid: 'Y' } }] }),
      '/api/dc/expected_tat': () => json({ success: true, data: { tat: 3 } }),
    })
    const p = new DelhiveryProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({
      serviceable: true,
      codAvailable: true,
      minTransitDays: 3,
      maxTransitDays: 3,
    })
    expect(f.calls[0]?.init?.headers).toMatchObject({ Authorization: 'Token tok' })
    expect(f.calls[1]?.url.searchParams.get('mot')).toBe('S')
    expect(f.calls[1]?.url.searchParams.get('pdt')).toBe('B2C')
  })

  it('an empty delivery_codes list is unserviceable, not an error, and skips the TAT call', async () => {
    const f = fakeFetch({ '/c/api/pin-codes/json/': () => json({ delivery_codes: [] }) })
    const p = new DelhiveryProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '744101' })
    expect(r.serviceable).toBe(false)
    expect(f.calls).toHaveLength(1)
  })

  it('a failing TAT endpoint leaves transit days null instead of failing the lookup', async () => {
    const f = fakeFetch({
      '/c/api/pin-codes/json/': () =>
        json({ delivery_codes: [{ postal_code: { cod: 'N', pre_paid: 'Y' } }] }),
      '/api/dc/expected_tat': () => json({ success: false }, 500),
    })
    const p = new DelhiveryProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({ serviceable: true, codAvailable: false, minTransitDays: null })
  })

  it('maps 401 to an auth CourierError', async () => {
    const f = fakeFetch({ '/c/api/pin-codes/json/': () => new Response('', { status: 401 }) })
    const p = new DelhiveryProvider({ ...config, fetchImpl: f.impl })
    await expect(
      p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' }),
    ).rejects.toMatchObject({ kind: 'auth' })
    expect((await p.verifyCredentials()).ok).toBe(false)
  })

  it('reserves a waybill then posts the form-encoded shipment and returns a label link', async () => {
    const f = fakeFetch({
      '/waybill/api/bulk/json/': () => json('WB123'),
      '/api/cmu/create.json': () =>
        json({ success: true, packages: [{ waybill: 'WB123', status: 'Success' }] }),
    })
    const p = new DelhiveryProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      paymentMode: 'cod',
      codAmountPaise: 199900,
    })
    expect(r.waybill).toBe('WB123')
    expect(r.labelUrl).toContain('WB123')

    const create = f.calls[1]
    expect(create?.init?.method).toBe('POST')
    expect(create?.init?.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    const body = new URLSearchParams(create?.init?.body as string)
    expect(body.get('format')).toBe('json')
    const data = JSON.parse(body.get('data') as string)
    expect(data.pickup_location.name).toBe('Waimers Sonipat')
    expect(data.shipments[0]).toMatchObject({
      waybill: 'WB123',
      order: '1',
      payment_mode: 'COD',
      cod_amount: '1999.00',
      pin: '560001',
      return_pin: '131028',
      weight: 500,
      quantity: 1,
    })
  })

  it('surfaces a rejected shipment with Delhivery reasons', async () => {
    const f = fakeFetch({
      '/waybill/api/bulk/json/': () => json({ waybill: 'WB9' }),
      '/api/cmu/create.json': () =>
        json({
          success: false,
          packages: [{ status: 'Error', remarks: ['Pickup location not found'] }],
        }),
    })
    const p = new DelhiveryProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('Pickup location not found'),
    })
  })

  it('normalises tracking scans into ordered events and a status', async () => {
    const f = fakeFetch({
      '/api/v1/packages/json/': () =>
        json({
          ShipmentData: [
            {
              Shipment: {
                AWB: 'WB123',
                Status: { Status: 'In Transit', StatusType: 'UD' },
                ExpectedDeliveryDate: '2026-09-25T00:00:00',
                Scans: [
                  {
                    ScanDetail: {
                      Scan: 'In Transit',
                      ScanType: 'UD',
                      ScanDateTime: '2026-09-22T08:00:00',
                      ScannedLocation: 'Delhi Hub',
                    },
                  },
                  {
                    ScanDetail: {
                      Scan: 'Picked Up',
                      ScanType: 'UD',
                      ScanDateTime: '2026-09-21T18:00:00',
                      ScannedLocation: 'Sonipat',
                    },
                  },
                ],
              },
            },
          ],
        }),
    })
    const p = new DelhiveryProvider({ ...config, fetchImpl: f.impl })
    const t = await p.track('WB123')
    expect(t.status).toBe('in_transit')
    expect(t.expectedDate).toBe('2026-09-25')
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'in_transit'])
    expect(t.trackingUrl).toContain('WB123')
  })

  it('cancels with the edit endpoint', async () => {
    const f = fakeFetch({ '/api/p/edit': () => json({ status: true }) })
    const p = new DelhiveryProvider({ ...config, fetchImpl: f.impl })
    await p.cancel('WB123')
    expect(f.calls[0]?.init?.body).toBe('waybill=WB123&cancellation=true')
  })

  it('maps status vocabulary', () => {
    expect(mapDelhiveryStatus('DL', 'Delivered')).toBe('delivered')
    expect(mapDelhiveryStatus('RT', 'RTO Initiated')).toBe('rto')
    expect(mapDelhiveryStatus('UD', 'Dispatched')).toBe('out_for_delivery')
    expect(mapDelhiveryStatus('PP', 'Manifested')).toBe('created')
    expect(mapDelhiveryStatus('CN', 'Cancelled')).toBe('cancelled')
  })
})

describe('delhiveryFactory', () => {
  it('requires token, names and a valid origin pincode', () => {
    expect(delhiveryFactory.validateConfig({})).toMatchObject({ ok: false })
    const r = delhiveryFactory.validateConfig({ ...config, expressMode: 'true', baseUrl: ' ' })
    expect(r).toMatchObject({ ok: true, config: { mode: 'E', baseUrl: undefined } })
  })
})

describeShippingProvider('delhivery (offline)', {
  create: () =>
    new DelhiveryProvider({
      ...config,
      fetchImpl: async () => {
        throw new CourierError('unavailable', 'delhivery', 'offline')
      },
    }),
})

const live = process.env.DELHIVERY_API_TOKEN
if (live) {
  describeShippingProvider('delhivery (live staging)', {
    live: true,
    create: () =>
      new DelhiveryProvider({
        apiToken: live,
        clientName: process.env.DELHIVERY_CLIENT_NAME ?? 'Waimers',
        pickupLocationName: process.env.DELHIVERY_PICKUP ?? 'Waimers',
        originPincode: process.env.DELHIVERY_ORIGIN_PIN ?? '131028',
        baseUrl: process.env.DELHIVERY_BASE_URL,
      }),
  })
}
