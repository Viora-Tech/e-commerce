import { CourierError } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import {
  cancelRefusal,
  mapShiprocketStatus,
  ShiprocketProvider,
  shiprocketFactory,
} from '../src/shiprocket'

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
  email: 'api-user@waimers.example',
  password: 'secret',
  pickupLocationName: 'Waimers Sonipat',
  originPincode: '131028',
}

const withLogin = (routes: Record<string, Route>) => ({
  '/v1/external/auth/login': () => json({ token: 'tok123' }),
  ...routes,
})

describe('ShiprocketProvider auth', () => {
  it('logs in once and reuses the token across calls', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/courier/serviceability/': () =>
          json({ data: { available_courier_companies: [] } }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    const logins = f.calls.filter((c) => c.url.pathname.endsWith('/auth/login'))
    expect(logins).toHaveLength(1)
  })

  it('maps a failed login to an auth CourierError', async () => {
    const f = fakeFetch({ '/v1/external/auth/login': () => json({ message: 'bad creds' }, 401) })
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await expect(
      p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' }),
    ).rejects.toMatchObject({ kind: 'auth' })
    expect((await p.verifyCredentials()).ok).toBe(false)
  })
})

describe('ShiprocketProvider serviceability and rates', () => {
  it('reports serviceable with the widest transit range and COD if any courier offers it', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/courier/serviceability/': () =>
          json({
            data: {
              available_courier_companies: [
                {
                  courier_company_id: 1,
                  courier_name: 'A',
                  cod: 0,
                  rate: 60,
                  estimated_delivery_days: '3',
                },
                {
                  courier_company_id: 2,
                  courier_name: 'B',
                  cod: 1,
                  rate: 90,
                  estimated_delivery_days: '5',
                },
              ],
            },
          }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({
      serviceable: true,
      codAvailable: true,
      minTransitDays: 3,
      maxTransitDays: 5,
    })
  })

  it('is unserviceable, not an error, when no couriers are returned', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/courier/serviceability/': () =>
          json({ data: { available_courier_companies: [] } }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '744101' })
    expect(r.serviceable).toBe(false)
  })

  it('quoteRate returns the cheapest courier', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/courier/serviceability/': () =>
          json({
            data: {
              available_courier_companies: [
                { courier_company_id: 1, rate: 90, estimated_delivery_days: '4' },
                { courier_company_id: 2, rate: 60, estimated_delivery_days: '3' },
              ],
            },
          }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const r = await p.quoteRate({
      originPincode: '131028',
      destinationPincode: '560001',
      weightGrams: 500,
      declaredValuePaise: 199900,
      paymentMode: 'prepaid',
    })
    expect(r).toEqual({ pricePaise: 6000, minTransitDays: 3, maxTransitDays: 3 })
  })

  it('quoteOptions returns every serviceable courier with its charges', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/courier/serviceability/': () =>
          json({
            data: {
              available_courier_companies: [
                {
                  courier_company_id: 1,
                  courier_name: 'Delhivery Surface',
                  rate: 60,
                  freight_charge: 52,
                  coverage_charges: 8,
                  charge_weight: 0.5,
                  cod: 0,
                  estimated_delivery_days: '3',
                },
                {
                  courier_company_id: 2,
                  courier_name: 'Xpressbees',
                  rate: 90,
                  cod: 1,
                  estimated_delivery_days: '2',
                },
              ],
            },
          }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const options = await p.quoteOptions({
      originPincode: '131028',
      destinationPincode: '560001',
      weightGrams: 500,
      declaredValuePaise: 199900,
      paymentMode: 'prepaid',
    })
    expect(options).toHaveLength(2)
    expect(options[0]).toMatchObject({
      serviceId: '1',
      carrier: 'Delhivery Surface',
      pricePaise: 6000,
      chargeableWeightGrams: 500,
      charges: [
        { kind: 'freight', pricePaise: 5200 },
        { kind: 'insurance', pricePaise: 800 },
      ],
    })
    expect(options[1]).toMatchObject({ serviceId: '2', codAvailable: true, charges: [] })
  })
})

describe('ShiprocketProvider createShipment', () => {
  it('creates an order, assigns an AWB and fetches a label', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/orders/create/adhoc': () =>
          json({ order_id: 555, shipment_id: 777, status: 'NEW' }),
        '/v1/external/courier/assign/awb': () =>
          json({
            awb_assign_status: 1,
            response: { data: { awb_code: 'SR999', courier_name: 'X' } },
          }),
        '/v1/external/courier/generate/label': () => json({ label_url: 'https://labels/777.pdf' }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      paymentMode: 'prepaid',
      codAmountPaise: 0,
    })
    expect(r).toMatchObject({
      waybill: 'SR999',
      providerRef: '777',
      labelUrl: 'https://labels/777.pdf',
    })

    const orderCall = f.calls.find((c) => c.url.pathname.endsWith('/orders/create/adhoc'))
    const body = JSON.parse(orderCall?.init?.body as string)
    expect(body).toMatchObject({
      pickup_location: 'Waimers Sonipat',
      payment_method: 'Prepaid',
      billing_pincode: '560001',
    })
  })

  it('books the courier picked in the rate table, and none when nothing was picked', async () => {
    const routes = withLogin({
      '/v1/external/orders/create/adhoc': () => json({ order_id: 1, shipment_id: 2 }),
      '/v1/external/courier/assign/awb': () => json({ response: { data: { awb_code: 'SR1' } } }),
      '/v1/external/courier/generate/label': () => json({ label_url: 'https://labels/2.pdf' }),
    })
    const assignBody = async (serviceId?: string) => {
      const f = fakeFetch(routes)
      const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
      await p.createShipment({ ...sampleShipment, serviceId })
      const call = f.calls.find((c) => c.url.pathname.endsWith('/courier/assign/awb'))
      return JSON.parse(call?.init?.body as string)
    }
    expect(await assignBody('42')).toEqual({ shipment_id: 2, courier_id: 42 })
    expect(await assignBody()).toEqual({ shipment_id: 2 })
  })

  it('surfaces a rejected order', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/orders/create/adhoc': () => json({ message: 'Invalid pickup location' }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('Invalid pickup location'),
    })
  })

  it('still returns the shipment when label generation fails', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/orders/create/adhoc': () => json({ order_id: 1, shipment_id: 2 }),
        '/v1/external/courier/assign/awb': () => json({ response: { data: { awb_code: 'SR1' } } }),
        '/v1/external/courier/generate/label': () => new Response('', { status: 500 }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment(sampleShipment)
    expect(r.waybill).toBe('SR1')
    expect(r.labelUrl).toBeUndefined()
  })
})

describe('ShiprocketProvider reverse pickup', () => {
  const returnInput = {
    returnId: 'r1',
    reference: 'R-3-1044',
    orderNumber: 1044,
    from: sampleShipment.to,
    to: sampleShipment.from,
    lines: sampleShipment.lines,
    valuePaise: 199900,
    weightGrams: 400,
  }

  it('creates a return order then assigns a return AWB', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/orders/create/return': () => json({ order_id: 9, shipment_id: 10 }),
        '/v1/external/courier/assign/awb': () => json({ response: { data: { awb_code: 'RSR1' } } }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createReturnPickup(returnInput)
    expect(r).toEqual({ waybill: 'RSR1', providerRef: '10' })
    const create = f.calls.find((c) => c.url.pathname.endsWith('/orders/create/return'))
    expect(create?.init?.method).toBe('POST')
    const body = JSON.parse(create?.init?.body as string)
    expect(body).toMatchObject({
      order_id: 'R-3-1044',
      pickup_customer_name: sampleShipment.to.name,
      pickup_pincode: sampleShipment.to.pincode,
      shipping_customer_name: sampleShipment.from.name,
      shipping_pincode: sampleShipment.from.pincode,
      payment_method: 'Prepaid',
      sub_total: 1999,
    })
    const assign = f.calls.find((c) => c.url.pathname.endsWith('/courier/assign/awb'))
    expect(JSON.parse(assign?.init?.body as string)).toEqual({ shipment_id: 10, is_return: 1 })
  })

  it('throws when Shiprocket rejects the return or assigns no AWB', async () => {
    const rejected = fakeFetch(
      withLogin({ '/v1/external/orders/create/return': () => json({ message: 'Bad pincode' }) }),
    )
    await expect(
      new ShiprocketProvider({ ...config, fetchImpl: rejected.impl }).createReturnPickup(
        returnInput,
      ),
    ).rejects.toMatchObject({ kind: 'rejected', message: expect.stringContaining('Bad pincode') })

    const noAwb = fakeFetch(
      withLogin({
        '/v1/external/orders/create/return': () => json({ order_id: 9, shipment_id: 10 }),
        '/v1/external/courier/assign/awb': () => json({ message: 'No courier available' }),
      }),
    )
    const err = await new ShiprocketProvider({ ...config, fetchImpl: noAwb.impl })
      .createReturnPickup(returnInput)
      .catch((e) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect(err.message).toContain('No courier available')
  })

  it('declares reverse pickup', () => {
    expect(shiprocketFactory.capabilities).toContain('reverse_pickup')
  })
})

describe('ShiprocketProvider tracking', () => {
  it('normalises tracking activities into ordered events and a status', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/courier/track/awb/': () =>
          json({
            SR999: {
              tracking_data: {
                current_status: 'In Transit',
                track_url: 'https://track/SR999',
                etd: '2026-09-28',
                shipment_track_activities: [
                  {
                    date: '2026-09-22 08:00:00',
                    status: 'In Transit',
                    activity: 'In Transit',
                    location: 'Delhi Hub',
                  },
                  {
                    date: '2026-09-21 18:00:00',
                    status: 'Picked Up',
                    activity: 'Picked Up',
                    location: 'Sonipat',
                  },
                ],
              },
            },
          }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const t = await p.track('SR999')
    expect(t.status).toBe('in_transit')
    expect(t.expectedDate).toBe('2026-09-28')
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'in_transit'])
    expect(t.trackingUrl).toBe('https://track/SR999')
    // Shiprocket writes India time with no offset: 08:00 IST is 02:30 UTC on any server clock.
    expect(t.events[1]?.at).toBe('2026-09-22T02:30:00.000Z')
  })

  it('keeps tracking when a scan date cannot be read', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/courier/track/awb/': () =>
          json({
            SR999: {
              tracking_data: {
                current_status: 'In Transit',
                shipment_track_activities: [{ date: 'not a date', status: 'In Transit' }],
              },
            },
          }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const t = await p.track('SR999')
    expect(t.status).toBe('in_transit')
    expect(t.events).toHaveLength(1)
  })
})

describe('ShiprocketProvider cancel a booked shipment', () => {
  const CANCEL = '/v1/external/orders/cancel/shipment/awbs'

  it('cancels by the AWB, not the stored shipment id core passes first', async () => {
    const f = fakeFetch(
      withLogin({ [CANCEL]: () => json({ message: 'Bulk Shipment cancellation is in progress.' }) }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await expect(
      p.cancel('987654', { waybill: 'SR123', providerRef: '987654' }),
    ).resolves.toBeUndefined()
    const call = f.calls.find((c) => c.url.pathname === CANCEL)
    expect(call?.init?.method).toBe('POST')
    expect(JSON.parse(call?.init?.body as string)).toEqual({ awbs: ['SR123'] })
    expect(new Headers(call?.init?.headers).get('authorization')).toBe('Bearer tok123')
    // The pending-order cancel is a different call and is not used here.
    expect(f.calls.some((c) => c.url.pathname === '/v1/external/orders/cancel')).toBe(false)
  })

  it('takes the first argument as the AWB when no ref is given', async () => {
    const f = fakeFetch(withLogin({ [CANCEL]: () => json({ message: 'ok' }) }))
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await p.cancel('SR777')
    const call = f.calls.find((c) => c.url.pathname === CANCEL)
    expect(JSON.parse(call?.init?.body as string)).toEqual({ awbs: ['SR777'] })
  })

  it('turns a 4xx refusal into a rejected error with Shiprocket’s reason', async () => {
    const f = fakeFetch(
      withLogin({
        [CANCEL]: () => json({ message: 'Shipment already picked up, cannot cancel' }, 400),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const err = await p.cancel('1', { waybill: 'SR123' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect(err).toMatchObject({
      kind: 'rejected',
      status: 400,
      reason: 'Shipment already picked up, cannot cancel',
    })
    expect((err as Error).message).toContain('SR123')
  })

  it('treats a 200 carrying status_code and errors as a refusal', async () => {
    const f = fakeFetch(
      withLogin({
        [CANCEL]: () => json({ status_code: 422, message: 'Invalid AWB', errors: { awbs: ['x'] } }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('1', { waybill: 'SR123' })).rejects.toMatchObject({
      kind: 'rejected',
      reason: 'Invalid AWB',
    })
  })

  it('keeps auth, rate-limit, server and network failures as their own kinds', async () => {
    const cases: [Route, string][] = [
      [() => json({ message: 'no' }, 401), 'auth'],
      [() => json({ message: 'slow down' }, 429), 'rate_limited'],
      [() => json({ message: 'boom' }, 502), 'unavailable'],
      [() => new Response('<html>oops</html>', { status: 200 }), 'bad_response'],
    ]
    for (const [route, kind] of cases) {
      const f = fakeFetch(withLogin({ [CANCEL]: route }))
      const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
      await expect(p.cancel('1', { waybill: 'SR123' })).rejects.toMatchObject({ kind })
    }
  })

  it('refuses an empty AWB without calling Shiprocket', async () => {
    const f = fakeFetch(withLogin({}))
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('  ', { waybill: '' })).rejects.toMatchObject({ kind: 'rejected' })
    expect(f.calls).toHaveLength(0)
  })

  it('declares cancel so the admin offers it', () => {
    expect(shiprocketFactory.capabilities).toContain('cancel')
  })

  it('reads refusals from a 2xx body only when it says so', () => {
    expect(cancelRefusal({ message: 'ok' })).toBeNull()
    expect(cancelRefusal({ message: 'ok', errors: [] })).toBeNull()
    expect(cancelRefusal({ message: 'ok', errors: {} })).toBeNull()
    expect(cancelRefusal({ status_code: 400 })).toBe('no detail returned')
    expect(cancelRefusal({ errors: 'AWB not found' })).toBe('AWB not found')
  })
})

describe('ShiprocketProvider NDR, wallet and webhook', () => {
  it('sends a reattempt NDR action', async () => {
    const f = fakeFetch(withLogin({ '/v1/external/ndr/reattempt': () => json({ message: 'ok' }) }))
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const r = await p.ndrAction({
      waybill: 'SR999',
      action: 'reattempt',
      deferredDate: '2026-09-26',
    })
    expect(r).toEqual({ accepted: true })
    const call = f.calls.find((c) => c.url.pathname.endsWith('/ndr/reattempt'))
    const body = JSON.parse(call?.init?.body as string)
    expect(body).toMatchObject({ awb: 'SR999', deferred_date: '2026-09-26' })
  })

  it('rejects an NDR action Shiprocket refuses', async () => {
    const f = fakeFetch(
      withLogin({ '/v1/external/ndr/reattempt': () => json({ error: 'AWB not in NDR' }) }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await expect(p.ndrAction({ waybill: 'SR999', action: 'reattempt' })).rejects.toMatchObject({
      kind: 'rejected',
      message: 'AWB not in NDR',
    })
  })

  it('rejects an rto NDR action outright since no endpoint is confirmed', async () => {
    const p = new ShiprocketProvider(config)
    await expect(p.ndrAction({ waybill: 'SR999', action: 'rto' })).rejects.toMatchObject({
      kind: 'unavailable',
    })
  })

  it('reads the wallet balance', async () => {
    const f = fakeFetch(
      withLogin({
        '/v1/external/account/details/wallet-balance': () =>
          json({ data: { balance_amount: 1234.5 } }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const w = await p.getWalletBalance()
    expect(w.balancePaise).toBe(123450)
  })

  it('parses a webhook body into notices keyed by AWB, status and scan timestamp', async () => {
    const p = new ShiprocketProvider({ ...config, webhookSecret: 'shh' })
    const notices = await p.parseWebhook({
      rawBody: JSON.stringify({
        awb: 'SR999',
        current_status: 'Delivered',
        current_timestamp: '2026-09-25T00:00:00',
      }),
      headers: { 'x-webhook-token': 'shh' },
    })
    expect(notices).toEqual([{ waybill: 'SR999', eventId: 'SR999:Delivered:2026-09-25T00:00:00' }])
  })

  it('never derives eventId from the server clock: a scan with no timestamp field is still stable', async () => {
    const p = new ShiprocketProvider({ ...config, webhookSecret: 'shh' })
    const payload = { awb: 'SR1', current_status: 'In Transit' }
    const a = await p.parseWebhook({
      rawBody: JSON.stringify(payload),
      headers: { 'x-webhook-token': 'shh' },
    })
    const b = await p.parseWebhook({
      rawBody: JSON.stringify(payload),
      headers: { 'x-webhook-token': 'shh' },
    })
    expect(a).toEqual(b)
  })

  it('fails closed: refuses any webhook call when no secret is configured', async () => {
    const p = new ShiprocketProvider(config)
    await expect(p.parseWebhook({ rawBody: '{}', headers: {} })).rejects.toMatchObject({
      kind: 'auth',
    })
  })

  it('rejects a webhook call with the wrong shared secret', async () => {
    const p = new ShiprocketProvider({ ...config, webhookSecret: 'shh' })
    await expect(
      p.parseWebhook({ rawBody: '{}', headers: { 'x-webhook-token': 'nope' } }),
    ).rejects.toMatchObject({ kind: 'auth' })
  })

  it('accepts the token in x-api-key, the header Shiprocket’s webhook form sends it in', async () => {
    const p = new ShiprocketProvider({ ...config, webhookSecret: 'shh' })
    const notices = await p.parseWebhook({
      rawBody: JSON.stringify({ awb: 'SR1', current_status: 'Delivered' }),
      headers: { 'x-api-key': 'shh' },
    })
    expect(notices.map((n) => n.waybill)).toEqual(['SR1'])
    await expect(
      p.parseWebhook({ rawBody: '{}', headers: { 'x-api-key': 'nope' } }),
    ).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('mapShiprocketStatus', () => {
  it('maps status vocabulary', () => {
    expect(mapShiprocketStatus('Delivered')).toBe('delivered')
    expect(mapShiprocketStatus('RTO Initiated')).toBe('rto')
    expect(mapShiprocketStatus('Out For Delivery')).toBe('out_for_delivery')
    expect(mapShiprocketStatus('Pickup Generated')).toBe('created')
    expect(mapShiprocketStatus('Picked Up')).toBe('picked_up')
    expect(mapShiprocketStatus('Shipped')).toBe('in_transit')
    expect(mapShiprocketStatus('Canceled')).toBe('cancelled')
  })
})

describe('shiprocketFactory', () => {
  it('requires a valid email, password and origin pincode', () => {
    expect(shiprocketFactory.validateConfig({})).toMatchObject({ ok: false })
    const r = shiprocketFactory.validateConfig({ ...config, baseUrl: ' ' })
    expect(r).toMatchObject({ ok: true, config: { email: config.email, baseUrl: undefined } })
  })

  it('rejects a malformed email', () => {
    const r = shiprocketFactory.validateConfig({ ...config, email: 'not-an-email' })
    expect(r).toMatchObject({ ok: false })
  })
})

describeShippingProvider('shiprocket (offline)', {
  create: () =>
    new ShiprocketProvider({
      ...config,
      fetchImpl: async () => {
        throw new CourierError('unavailable', 'shiprocket', 'offline')
      },
    }),
})

const live = process.env.SHIPROCKET_API_EMAIL
if (live) {
  describeShippingProvider('shiprocket (live)', {
    live: true,
    create: () =>
      new ShiprocketProvider({
        email: live,
        password: process.env.SHIPROCKET_API_PASSWORD ?? '',
        pickupLocationName: process.env.SHIPROCKET_PICKUP ?? 'Waimers',
        originPincode: process.env.SHIPROCKET_ORIGIN_PIN ?? '131028',
      }),
  })
}

describe('shiprocketFactory base URL', () => {
  it('only accepts the courier own https hosts, since the stored token is sent there', () => {
    expect(
      shiprocketFactory.validateConfig({
        ...config,
        baseUrl: 'https://apiv2.shiprocket.in/v1/external',
      }),
    ).toMatchObject({ ok: true })
    expect(
      shiprocketFactory.validateConfig({ ...config, baseUrl: 'https://attacker.example' }),
    ).toMatchObject({
      ok: false,
    })
    expect(
      shiprocketFactory.validateConfig({ ...config, baseUrl: 'https://10.0.0.5' }),
    ).toMatchObject({
      ok: false,
    })
  })
})
