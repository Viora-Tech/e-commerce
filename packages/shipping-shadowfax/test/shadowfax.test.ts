import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { mapShadowfaxStatus, scanDescription } from '../src/mapping'
import { ShadowfaxProvider, shadowfaxFactory } from '../src/shadowfax'

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
    if (!route) return new Response('{"message":"Not found"}', { status: 404 })
    return route(url, init)
  }
  return { impl, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? '{}')

const config = {
  apiToken: 'sfx-key',
  originPincode: '131028',
  webhookSecret: 'sfx-hook-key',
}

const returnInput = {
  returnId: 'ret-1',
  reference: 'R-12-1044',
  orderNumber: 1044,
  from: sampleShipment.to,
  to: sampleShipment.from,
  lines: sampleShipment.lines,
  valuePaise: 199900,
  weightGrams: 500,
}

describe('ShadowfaxProvider serviceability', () => {
  it('sends the Token header and reads a listed PIN as serviceable', async () => {
    const f = fakeFetch({
      '/api/v1/clients/serviceability/': () => json([{ code: 560001, services: ['Regular'] }]),
    })
    const p = new ShadowfaxProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({ serviceable: true, codAvailable: true, minTransitDays: null })
    expect(f.calls[0]?.url.searchParams.get('service')).toBe('customer_delivery')
    expect((f.calls[0]?.init?.headers as Record<string, string> | undefined)?.Authorization).toBe(
      'Token sfx-key',
    )
  })

  it('reads an absent PIN as unserviceable', async () => {
    const f = fakeFetch({ '/api/v1/clients/serviceability/': () => json([]) })
    const p = new ShadowfaxProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '999999' })
    expect(r.serviceable).toBe(false)
  })

  it('turns a wrong key into an actionable message', async () => {
    const f = fakeFetch({
      '/api/v1/clients/serviceability/': () => new Response('', { status: 401 }),
    })
    const r = await new ShadowfaxProvider({ ...config, fetchImpl: f.impl }).verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/staging and production/)
  })
})

describe('ShadowfaxProvider bookings', () => {
  it('books a COD marketplace order and fetches its label', async () => {
    const f = fakeFetch({
      '/api/v3/clients/orders/': () =>
        json({
          message: 'Success',
          data: { awb_number: 'SF610198449AAA', client_order_id: '1-conforma' },
        }),
      '/api/client/generate_label/': () =>
        json({ message: 'Success', data: { label_url: 'https://sfx.s3/SF610198449AAA.pdf' } }),
    })
    const p = new ShadowfaxProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      paymentMode: 'cod',
      codAmountPaise: 199900,
    })
    expect(r).toEqual({
      waybill: 'SF610198449AAA',
      providerRef: '1-conforma',
      labelUrl: 'https://sfx.s3/SF610198449AAA.pdf',
    })
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === '/api/v3/clients/orders/')?.init)
    expect(sent).toMatchObject({
      order_type: 'marketplace',
      order_details: { payment_mode: 'COD', cod_amount: 1999, product_value: 1999 },
      customer_details: { pincode: 560001, contact: '9999999999' },
      pickup_details: { pincode: 131028 },
      rts_details: { pincode: 131028 },
    })
  })

  it('books prepaid with nothing to collect, and keeps the booking when the label fails', async () => {
    const f = fakeFetch({
      '/api/v3/clients/orders/': () => json({ message: 'Success', data: { awb_number: 'SF2' } }),
      '/api/client/generate_label/': () =>
        json({ message: 'Labels can only be fetched before pickup' }, 400),
    })
    const p = new ShadowfaxProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment(sampleShipment)
    expect(r).toMatchObject({ waybill: 'SF2', labelUrl: undefined })
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === '/api/v3/clients/orders/')?.init)
    expect(sent.order_details).toMatchObject({ payment_mode: 'Prepaid', cod_amount: 0 })
  })

  it('reads a refusal from a 200 Failure and from a 400 body', async () => {
    const failure = fakeFetch({
      '/api/v3/clients/orders/': () =>
        json({
          message: 'Failure',
          errors: 'Invalid Pickup Pincode. Pickup pincode 160022 is not serviceable',
        }),
    })
    await expect(
      new ShadowfaxProvider({ ...config, fetchImpl: failure.impl }).createShipment(sampleShipment),
    ).rejects.toMatchObject({ kind: 'rejected', message: expect.stringContaining('160022') })

    const bad = fakeFetch({
      '/api/v3/clients/orders/': () =>
        json({ message: 'Failure', errors: { customer_details: { contact: ['Invalid'] } } }, 400),
    })
    await expect(
      new ShadowfaxProvider({ ...config, fetchImpl: bad.impl }).createShipment(sampleShipment),
    ).rejects.toMatchObject({ kind: 'rejected', message: expect.stringContaining('contact') })
  })

  it('books a reverse pickup and returns its request id as the AWB', async () => {
    const f = fakeFetch({
      '/api/v3/clients/requests': () =>
        json({
          message: 'Success',
          client_request_id: 'R10000021ZI',
          client_order_number: 'R-12-1044',
        }),
    })
    const p = new ShadowfaxProvider({ ...config, fetchImpl: f.impl })
    expect(await p.createReturnPickup(returnInput)).toEqual({
      waybill: 'R10000021ZI',
      providerRef: 'R-12-1044',
    })
    const sent = bodyOf(f.calls[0]?.init)
    expect(sent).toMatchObject({
      client_order_number: 'R-12-1044',
      destination_pincode: 131028,
      pickup_type: 'regular',
      address_attributes: { pincode: 560001, phone_number: '9999999999' },
    })
  })
})

describe('ShadowfaxProvider cancel', () => {
  it('treats 200 and 304 (queued) as cancelled', async () => {
    const ok = fakeFetch({
      '/api/v3/clients/orders/cancel/': () =>
        json({ responseMsg: 'Request has been marked as cancelled', responseCode: 200 }),
    })
    await expect(
      new ShadowfaxProvider({ ...config, fetchImpl: ok.impl }).cancel('SF1'),
    ).resolves.toBeUndefined()
    const queued = fakeFetch({
      '/api/v3/clients/orders/cancel/': () => new Response(null, { status: 304 }),
    })
    await expect(
      new ShadowfaxProvider({ ...config, fetchImpl: queued.impl }).cancel('SF1'),
    ).resolves.toBeUndefined()
  })

  it('rejects a responseCode 400 inside HTTP 200', async () => {
    const f = fakeFetch({
      '/api/v3/clients/orders/cancel/': () =>
        json({ responseMsg: 'Order cannot be cancelled. Invalid state.', responseCode: 400 }),
    })
    await expect(
      new ShadowfaxProvider({ ...config, fetchImpl: f.impl }).cancel('SF1'),
    ).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('Invalid state'),
    })
  })

  it('cancels a reverse AWB on the reverse endpoint first', async () => {
    const f = fakeFetch({
      '/api/v2/clients/requests/mark_cancel': () => json({ responseMsg: 'ok', responseCode: 200 }),
    })
    await new ShadowfaxProvider({ ...config, fetchImpl: f.impl }).cancel('R10000021ZI')
    expect(f.calls[0]?.url.pathname).toBe('/api/v2/clients/requests/mark_cancel')
    expect(bodyOf(f.calls[0]?.init)).toMatchObject({ request_id: 'R10000021ZI' })
  })
})

describe('ShadowfaxProvider tracking', () => {
  it('tracks a forward AWB from its history', async () => {
    const f = fakeFetch({
      '/api/v4/clients/orders/SF1/track/': () =>
        json({
          order_details: { awb_number: 'SF1', status: 'Out For Delivery', status_id: 'ofd' },
          tracking_details: [
            {
              created: '2026-10-19 09:10:00',
              location: 'BLR_Hub',
              status_id: 'ofd',
              remarks: 'Item OFD',
            },
            {
              created: '2026-10-17 18:00:00',
              location: 'SNP',
              status_id: 'picked',
              remarks: 'Picked',
            },
          ],
        }),
    })
    const t = await new ShadowfaxProvider({ ...config, fetchImpl: f.impl }).track('SF1')
    expect(t.status).toBe('out_for_delivery')
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'out_for_delivery'])
    expect(t.events[0]?.at).toBe('2026-10-17T12:30:00.000Z')
  })

  it('tracks a reverse AWB on the reverse endpoint', async () => {
    const f = fakeFetch({
      '/api/v4/clients/requests/R1': () =>
        json({
          client_request_id: 'R1',
          status: 'Picked',
          pickup_request_state_histories: [
            { created_at: '2022-02-28T10:26:19Z', state: 'New', comment: 'Item New' },
            { created_at: '2022-02-28T11:00:00Z', state: 'Picked', comment: 'Picked' },
          ],
        }),
    })
    const t = await new ShadowfaxProvider({ ...config, fetchImpl: f.impl }).track('R1')
    expect(t).toMatchObject({ status: 'picked_up' })
    expect(t.events.map((e) => e.status)).toEqual(['created', 'picked_up'])
  })

  it('maps the documented status ids', () => {
    expect(mapShadowfaxStatus('delivered')).toBe('delivered')
    expect(mapShadowfaxStatus('rts_d')).toBe('rto')
    expect(mapShadowfaxStatus('Returned To Client')).toBe('rto')
    expect(mapShadowfaxStatus('cancelled_by_customer')).toBe('cancelled')
    expect(mapShadowfaxStatus('assigned_for_seller_pickup')).toBe('created')
    expect(mapShadowfaxStatus('nc')).toBe('in_transit')
    expect(mapShadowfaxStatus('reopen_ndr')).toBe('in_transit')
  })
})

describe('ShadowfaxProvider NDR', () => {
  it('reopens with new delivery details, and asks for RTO', async () => {
    const f = fakeFetch({ '/api/v3/clients/order_update/': () => json({ message: 'Success' }) })
    const p = new ShadowfaxProvider({ ...config, fetchImpl: f.impl })
    await p.ndrAction({
      waybill: 'SF1',
      action: 'change_address',
      address: '14 MG Road',
      phone: '98765 43210',
    })
    await p.ndrAction({ waybill: 'SF1', action: 'rto' })
    const sent = f.calls.map((c) => bodyOf(c.init))
    expect(sent[0]).toEqual({
      awb_number: 'SF1',
      status: 'reopen_ndr',
      delivery_details: { contact: '9876543210', address_line_1: '14 MG Road' },
    })
    expect(sent[1]).toEqual({ awb_number: 'SF1', status: 'rto' })
  })

  it('rejects a refused update', async () => {
    const f = fakeFetch({
      '/api/v3/clients/order_update/': () =>
        json({ message: 'Failure', errors: 'Invalid state' }, 400),
    })
    const p = new ShadowfaxProvider({ ...config, fetchImpl: f.impl })
    await expect(p.ndrAction({ waybill: 'SF1', action: 'reattempt' })).rejects.toMatchObject({
      kind: 'rejected',
    })
  })
})

describe('ShadowfaxProvider webhook', () => {
  const rawBody = JSON.stringify({
    awb_number: 'SF610198449AAA',
    event: 'delivered',
    status: 'Delivered',
    event_timestamp: '2023-05-18 16:22:13',
  })

  it('accepts the configured key with or without the Token prefix', async () => {
    const p = new ShadowfaxProvider(config)
    const expected = [
      { waybill: 'SF610198449AAA', eventId: 'SF610198449AAA:delivered:2023-05-18 16:22:13' },
    ]
    expect(await p.parseWebhook({ rawBody, headers: { authorization: 'sfx-hook-key' } })).toEqual(
      expected,
    )
    expect(
      await p.parseWebhook({ rawBody, headers: { authorization: 'Token sfx-hook-key' } }),
    ).toEqual(expected)
  })

  it('refuses a wrong or missing key, and every push without a configured secret', async () => {
    const p = new ShadowfaxProvider(config)
    await expect(
      p.parseWebhook({ rawBody, headers: { authorization: 'nope' } }),
    ).rejects.toMatchObject({ kind: 'auth' })
    await expect(p.parseWebhook({ rawBody, headers: {} })).rejects.toMatchObject({ kind: 'auth' })
    const bare = new ShadowfaxProvider({ ...config, webhookSecret: undefined })
    await expect(
      bare.parseWebhook({ rawBody, headers: { authorization: 'sfx-hook-key' } }),
    ).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('shadowfaxFactory', () => {
  it('accepts the staging host and refuses other hosts', () => {
    expect(
      shadowfaxFactory.validateConfig({
        ...config,
        baseUrl: 'https://dale.staging.shadowfax.in/api',
      }).ok,
    ).toBe(true)
    const bad = shadowfaxFactory.validateConfig({
      ...config,
      apiToken: '',
      baseUrl: 'https://evil.example.com',
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors).toHaveLength(2)
  })

  it('flags the API key and webhook key as secret', () => {
    expect(shadowfaxFactory.fields.filter((f) => f.secret).map((f) => f.key)).toEqual([
      'apiToken',
      'webhookSecret',
    ])
  })
})

describe('Shadowfax scan wording for NDR', () => {
  it('marks a failed-attempt status so the NDR queue picks it up', () => {
    expect(scanDescription('nc', 'Customer not contactable')).toBe(
      'Undelivered: Customer not contactable',
    )
    expect(scanDescription('cid', 'Customer wants delivery on another date')).toMatch(
      /^Undelivered: /,
    )
    expect(scanDescription('ofd', 'Item OFD at BLR')).toBe('Item OFD at BLR')
  })
})

describeShippingProvider('shadowfax (offline)', {
  create: () =>
    new ShadowfaxProvider({
      ...config,
      fetchImpl: async () => {
        throw new TypeError('network down')
      },
    }),
})
