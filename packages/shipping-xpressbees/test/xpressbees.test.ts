import { createHmac } from 'node:crypto'
import { CourierError } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { mapXpressbeesStatus, scanDescription } from '../src/mapping'
import { XpressbeesProvider, xpressbeesFactory } from '../src/xpressbees'

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** A fetch that records every call and answers from a route table (longest path first). */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: URL; init?: RequestInit | undefined }[] = []
  const impl: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    calls.push({ url, init })
    const route = Object.entries(routes)
      .sort(([a], [b]) => b.length - a.length)
      .find(([path]) => url.pathname.startsWith(path))?.[1]
    if (!route) return new Response('not found', { status: 404 })
    return route(url, init)
  }
  return { impl, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? '{}')

const config = {
  email: 'ops@waimers.in',
  password: 'xb-pass',
  warehouseName: 'Sonipat WH',
  originPincode: '131028',
  webhookSecret: 'xb-hook-secret',
}

const login = () => json({ status: true, data: 'xb-token' })

const rates = (init?: RequestInit) => {
  const cod = bodyOf(init).payment_type === 'cod'
  return json({
    status: true,
    data: [
      {
        id: '1',
        name: 'Xpressbees Surface 0.5 Kg',
        freight_charges: 55,
        cod_charges: cod ? 30 : 0,
        total_charges: cod ? 85 : 55,
        chargeable_weight: 500,
      },
      { id: '3', name: 'Xpressbees Air', freight_charges: 90, cod_charges: 0, total_charges: 90 },
    ],
  })
}

describe('XpressbeesProvider auth', () => {
  it('logs in once and sends the bearer token on later calls', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/courier/serviceability': (_u, i) => rates(i),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    await p.checkServiceability({ originPincode: '131028', destinationPincode: '110001' })
    expect(f.calls.filter((c) => c.url.pathname.endsWith('/users/login'))).toHaveLength(1)
    const rate = f.calls.find((c) => c.url.pathname.endsWith('/serviceability'))
    expect((rate?.init?.headers as Record<string, string> | undefined)?.Authorization).toBe(
      'Bearer xb-token',
    )
  })

  it('logs in again once when a call answers 401', async () => {
    let first = true
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/shipments2/cancel': () => {
        if (first) {
          first = false
          return new Response('expired', { status: 401 })
        }
        return json({ status: true, message: 'cancelled' })
      },
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('XB1')).resolves.toBeUndefined()
    expect(f.calls.filter((c) => c.url.pathname.endsWith('/users/login'))).toHaveLength(2)
  })

  it('reports a bad login as an actionable message, not a throw', async () => {
    const f = fakeFetch({ '/api/users/login': () => json({ status: false, message: 'Invalid' }) })
    const r = await new XpressbeesProvider({ ...config, fetchImpl: f.impl }).verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/shipment\.xpressbees\.com/)
  })
})

describe('XpressbeesProvider serviceability and rates', () => {
  it('is serviceable with COD when the COD quote has services', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/courier/serviceability': (_u, i) => rates(i),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({ serviceable: true, codAvailable: true, minTransitDays: null })
  })

  it('is unserviceable, not an error, when Xpressbees answers status false', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/courier/serviceability': () => json({ status: false, message: 'Not serviceable' }),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '999999' })
    expect(r).toMatchObject({ serviceable: false, codAvailable: false })
  })

  it('lists each service with its itemised charges and quotes the cheapest', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/courier/serviceability': (_u, i) => rates(i),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    const query = {
      originPincode: '131028',
      destinationPincode: '560001',
      weightGrams: 400,
      declaredValuePaise: 199900,
      paymentMode: 'cod' as const,
    }
    const options = await p.quoteOptions(query)
    expect(options[0]).toMatchObject({
      serviceId: '1',
      pricePaise: 8500,
      codAvailable: true,
      charges: [
        { kind: 'freight', pricePaise: 5500 },
        { kind: 'cod', pricePaise: 3000 },
      ],
      chargeableWeightGrams: 500,
    })
    expect(await p.quoteRate(query)).toMatchObject({ pricePaise: 8500 })
    const sent = bodyOf(f.calls.find((c) => c.url.pathname.endsWith('/serviceability'))?.init)
    expect(sent).toMatchObject({ origin: '131028', destination: '560001', payment_type: 'cod' })
  })
})

describe('XpressbeesProvider bookings', () => {
  it('books a COD shipment with the picked service, auto pickup and the warehouse name', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/shipments2': () =>
        json({
          status: true,
          data: {
            awb_number: '14344924000012',
            label: 'https://xb.s3/label.pdf',
            status: 'booked',
          },
        }),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      paymentMode: 'cod',
      codAmountPaise: 199900,
      serviceId: '3',
    })
    expect(r).toEqual({
      waybill: '14344924000012',
      providerRef: '14344924000012',
      labelUrl: 'https://xb.s3/label.pdf',
    })
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === '/api/shipments2')?.init)
    expect(sent).toMatchObject({
      payment_type: 'cod',
      collectable_amount: 1999,
      order_amount: 1999,
      courier_id: '3',
      request_auto_pickup: 'yes',
      pickup: { warehouse_name: 'Sonipat WH', pincode: '131028' },
      consignee: { pincode: '560001', phone: '9999999999' },
    })
  })

  it('books prepaid with nothing to collect', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/shipments2': () => json({ status: true, data: { awb_number: 'XB2' } }),
    })
    await new XpressbeesProvider({ ...config, fetchImpl: f.impl }).createShipment(sampleShipment)
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === '/api/shipments2')?.init)
    expect(sent).toMatchObject({ payment_type: 'prepaid', collectable_amount: 0 })
    expect(sent.courier_id).toBeUndefined()
  })

  it('surfaces a refused booking as rejected', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/shipments2': () => json({ status: false, message: 'Pincode not serviceable' }),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('Pincode not serviceable'),
    })
  })

  it('returns the manifest URL', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/shipments2/manifest': () => json({ status: true, data: 'https://xb.s3/manifest.pdf' }),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    expect(await p.generateManifest(['XB1', 'XB2'])).toBe('https://xb.s3/manifest.pdf')
  })

  it('rejects a cancel Xpressbees refuses', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/shipments2/cancel': () => json({ status: false, message: 'Already picked' }),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('XB1')).rejects.toBeInstanceOf(CourierError)
  })
})

describe('XpressbeesProvider tracking', () => {
  it('maps the scan history oldest first and reads India-time stamps', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/shipments2/track/XB1': () =>
        json({
          status: true,
          data: {
            awb_number: 'XB1',
            status: 'out for delivery',
            history: [
              {
                status_code: 'OFD',
                location: 'Bengaluru',
                event_time: '2026-10-19 09:10',
                message: 'Out for delivery',
              },
              {
                status_code: 'PU',
                location: 'Sonipat',
                event_time: '2026-10-16 18:00',
                message: 'Picked up',
              },
            ],
          },
        }),
    })
    const t = await new XpressbeesProvider({ ...config, fetchImpl: f.impl }).track('XB1')
    expect(t.status).toBe('out_for_delivery')
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'out_for_delivery'])
    expect(t.events[0]?.at).toBe('2026-10-16T12:30:00.000Z')
  })

  it('lets a terminal coarse status win over the last scan', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/shipments2/track/XB1': () =>
        json({ status: true, data: { status: 'rto', history: [{ status_code: 'IT' }] } }),
    })
    const t = await new XpressbeesProvider({ ...config, fetchImpl: f.impl }).track('XB1')
    expect(t.status).toBe('rto')
  })

  it('maps codes and status text, never calling an attempt delivered', () => {
    expect(mapXpressbeesStatus('DL')).toBe('delivered')
    expect(mapXpressbeesStatus('RT-DL')).toBe('rto')
    expect(mapXpressbeesStatus('UD')).toBe('in_transit')
    expect(mapXpressbeesStatus(null, 'undelivered')).toBe('in_transit')
    expect(mapXpressbeesStatus(null, 'pending pickup')).toBe('created')
    expect(mapXpressbeesStatus(null, 'cancelled')).toBe('cancelled')
    expect(mapXpressbeesStatus('??', 'something new')).toBe('in_transit')
  })
})

describe('XpressbeesProvider NDR', () => {
  it('sends a re-attempt with its date', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/ndr/create': () => json({ status: true }),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    await p.ndrAction({ waybill: 'XB1', action: 'reattempt', deferredDate: '2026-10-22' })
    const sent = bodyOf(f.calls.find((c) => c.url.pathname.endsWith('/ndr/create'))?.init)
    expect(sent).toEqual([
      { awb: 'XB1', action: 're-attempt', action_data: { re_attempt_date: '2026-10-22' } },
    ])
  })

  it('splits a new address and phone into two actions', async () => {
    const f = fakeFetch({
      '/api/users/login': login,
      '/api/ndr/create': () => json({ status: true }),
    })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    await p.ndrAction({
      waybill: 'XB1',
      action: 'change_address',
      address: '14 MG Road',
      phone: '+91 98765 43210',
    })
    const sent = bodyOf(f.calls.find((c) => c.url.pathname.endsWith('/ndr/create'))?.init)
    expect(sent.map((a: { action: string }) => a.action)).toEqual([
      'change_address',
      'change_phone',
    ])
    expect(sent[1].action_data.phone).toBe('9876543210')
  })

  it('refuses RTO without calling Xpressbees', async () => {
    const f = fakeFetch({ '/api/users/login': login })
    const p = new XpressbeesProvider({ ...config, fetchImpl: f.impl })
    await expect(p.ndrAction({ waybill: 'XB1', action: 'rto' })).rejects.toMatchObject({
      kind: 'rejected',
    })
    expect(f.calls.some((c) => c.url.pathname.endsWith('/ndr/create'))).toBe(false)
  })
})

describe('XpressbeesProvider webhook', () => {
  const rawBody = JSON.stringify({
    awb_number: 'XB1',
    status_code: 'DL',
    event_time: '2026-10-20 10:00',
  })
  const sign = (secret: string) => createHmac('sha256', secret).update(rawBody).digest('base64')

  it('accepts a body signed with the secret and returns its AWB', async () => {
    const p = new XpressbeesProvider(config)
    const notices = await p.parseWebhook({
      rawBody,
      headers: { 'x-hmac-sha256': sign(config.webhookSecret) },
    })
    expect(notices).toEqual([{ waybill: 'XB1', eventId: 'XB1:DL:2026-10-20 10:00' }])
  })

  it('refuses a wrong signature, a missing one and a missing secret', async () => {
    const p = new XpressbeesProvider(config)
    await expect(
      p.parseWebhook({ rawBody, headers: { 'x-hmac-sha256': sign('wrong') } }),
    ).rejects.toMatchObject({ kind: 'auth' })
    await expect(p.parseWebhook({ rawBody, headers: {} })).rejects.toMatchObject({ kind: 'auth' })
    const bare = new XpressbeesProvider({ ...config, webhookSecret: undefined })
    await expect(
      bare.parseWebhook({ rawBody, headers: { 'x-hmac-sha256': sign(config.webhookSecret) } }),
    ).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('xpressbeesFactory', () => {
  it('validates the fields and keeps the base URL on xpressbees.com', () => {
    expect(xpressbeesFactory.validateConfig({ ...config }).ok).toBe(true)
    const bad = xpressbeesFactory.validateConfig({
      ...config,
      email: 'nope',
      originPincode: '12',
      baseUrl: 'https://evil.example.com',
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors).toHaveLength(3)
  })

  it('flags the password and webhook secret as secret', () => {
    const secret = xpressbeesFactory.fields.filter((f) => f.secret).map((f) => f.key)
    expect(secret).toEqual(['password', 'webhookSecret'])
  })
})

describe('Xpressbees scan wording for NDR', () => {
  it('marks an undelivered scan so the NDR queue picks it up', () => {
    expect(scanDescription('UD', 'Consignee shifted')).toBe('Undelivered: Consignee shifted')
    expect(scanDescription('UD', 'Undelivered - door locked')).toBe('Undelivered - door locked')
    expect(scanDescription('IT', 'Bag received')).toBe('Bag received')
  })
})

describeShippingProvider('xpressbees (offline)', {
  create: () =>
    new XpressbeesProvider({
      ...config,
      fetchImpl: async () => {
        throw new TypeError('network down')
      },
    }),
})
