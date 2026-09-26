import { CourierError } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { RapidshypProvider, rapidshypFactory } from '../src/rapidshyp'

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
      '/rapidshyp/apis/v1/serviceability_check': (_url, init) => {
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
    const calls = f.calls.filter((c) => c.url.pathname.endsWith('/serviceability_check'))
    expect(calls).toHaveLength(2)
  })

  it('is unserviceable, not an error, when no couriers are returned', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceability_check': () =>
        json({ status: true, serviceable_courier_list: [] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '744101' })
    expect(r.serviceable).toBe(false)
  })

  it('quoteRate returns the cheapest courier', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceability_check': () =>
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
      '/rapidshyp/apis/v1/serviceability_check': (_url, init) => {
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
      '/rapidshyp/apis/v1/serviceability_check': () => new Response('', { status: 401 }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(
      p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' }),
    ).rejects.toMatchObject({ kind: 'auth' })
    expect((await p.verifyCredentials()).ok).toBe(false)
  })
})

describe('RapidshypProvider createShipment', () => {
  it('creates an order and reads the AWB off the shipment array', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () =>
        json({
          status: true,
          order_id: 'ord-1',
          shipment: [
            { awb: 'RS999', shipment_id: 'ship-1', label_url: 'https://labels/ship-1.pdf' },
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
      providerRef: 'ship-1',
      labelUrl: 'https://labels/ship-1.pdf',
    })

    const call = f.calls.find((c) => c.url.pathname.endsWith('/create_order'))
    const body = JSON.parse(call?.init?.body as string)
    expect(body).toMatchObject({
      pickupAddressName: 'Waimers Sonipat',
      storeName: 'DEFAULT',
      paymentMethod: 'PREPAID',
    })
    expect(body.shippingAddress).toMatchObject({ pinCode: sampleShipment.to.pincode })
  })

  it('surfaces a rejected order', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () => json({ status: false, remarks: 'Invalid pincode' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('Invalid pincode'),
    })
  })

  it('fails with bad_response when order succeeds but no AWB shape is recognised', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () =>
        json({ status: true, order_id: 'ord-2', shipment: [{ shipment_id: 'ship-2' }] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({ kind: 'bad_response' })
  })
})

describe('RapidshypProvider unconfirmed capabilities', () => {
  it('track() throws unavailable - no confirmed tracking endpoint', async () => {
    const p = new RapidshypProvider(config)
    await expect(p.track('RS999')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('cancel() throws unavailable - cancel_order needs the RapidShyp order id, not the AWB', async () => {
    const p = new RapidshypProvider(config)
    await expect(p.cancel('RS999')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('has no ndrAction, getWalletBalance or parseWebhook - none confirmed', () => {
    const p = new RapidshypProvider(config)
    expect(p.ndrAction).toBeUndefined()
    expect(p.getWalletBalance).toBeUndefined()
    expect(p.parseWebhook).toBeUndefined()
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

  it('only declares the confirmed capabilities', () => {
    expect(rapidshypFactory.capabilities).toEqual(['serviceability', 'rates', 'create_shipment'])
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
