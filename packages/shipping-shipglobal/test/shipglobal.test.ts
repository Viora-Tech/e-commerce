import { CourierError, type CreateShipmentInput } from '@commerce/shipping'
import { describeShippingProvider } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { SHIPGLOBAL_API_URL, SHIPGLOBAL_TRACKING_PAGE } from '../src/client'
import { shipglobalFactory } from '../src/factory'
import { ShipglobalProvider } from '../src/shipglobal'

/*
 * Fixtures are shaped from ShipGlobal's vendor API docs ("ApiV1 ShipGlobal Vendor -
 * Production", https://developer.docs.shipglobal.in/, published 2026-11-03).
 */

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** A fetch that records every call and answers from a route table keyed by path. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: URL; init?: RequestInit | undefined }[] = []
  const impl: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    calls.push({ url, init })
    const route = Object.entries(routes).find(([path]) => url.pathname.endsWith(path))?.[1]
    if (!route) return new Response('not found', { status: 404 })
    return route(url, init)
  }
  return { impl, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? '{}')
const headerOf = (init: RequestInit | undefined, name: string) =>
  (init?.headers as Record<string, string> | undefined)?.[name]

const NOW = new Date('2026-10-31T06:30:00Z') // 12:00 in India

/** The docs' answer to a wrong username or password. */
const AUTH_FAILED = {
  success: false,
  error: 'Authorization Failed, Invalid Username/Password Combination',
  error_code: 'EA_401',
}

const RATES_OK = {
  success: true,
  billed_weight: 1200,
  billed_weight_unit: 'GM',
  currency: 'INR',
  services: [
    {
      title: 'ShipGlobal Direct',
      notes: '',
      transit_time: '7-10 Days',
      price: { logistic_fee: 1285 },
      subtotal_fee: 1300,
    },
    {
      title: 'UPS',
      notes: 'Duties will be charged, if applicable.',
      transit_time: '4 - 7 Days',
      price: { logistic_fee: 2247 },
      subtotal_fee: 2247,
    },
  ],
}

const ADD_OK = { success: true, tracking: 'SG32607086295274' }
const LABEL_OK = { success: true, tracking: 'SG32607086295274', label: 'JVBERi0xLjQK' }

const TRACKING_OK = {
  success: true,
  data: {
    awbEvents: [
      {
        awb_history_id: '4277696',
        awb_history_datetime: '2023-10-03 10:46:11',
        awb_history_location: 'San Jose, CA, US',
        awb_history_comment: 'DELIVERED ',
        type: 'lastmile',
        awb_event_code: 'SGE_304',
      },
      {
        awb_history_id: '4277695',
        awb_history_datetime: '2023-10-03 09:26:22',
        awb_history_location: 'Springfield Gardens, NY, US',
        awb_history_comment: 'Out For Delivery Today',
        type: 'lastmile',
        awb_event_code: 'SGE_303',
      },
      {
        awb_history_id: '4246965',
        awb_history_datetime: '2023-09-30 18:07:00',
        awb_history_location: 'USA',
        awb_history_comment: 'Shipment Cleared & Handed Over for Connection',
        type: 'connector',
        awb_event_code: 'SGE_208',
      },
    ],
  },
}

const config = {
  username: 'waimers-api',
  password: 'not-a-real-password',
  addressNickname: undefined,
  customerNickname: undefined,
  originPincode: '131028',
  originCity: 'Sonipat',
  iec: 'ABCDE1234F',
  iossNumber: undefined,
  service: 'ShipGlobal Direct' as const,
  now: () => NOW,
}

const exportShipment: CreateShipmentInput = {
  orderId: '0b7f3c1e-1111-4a5b-9c2d-000000001042',
  orderNumber: 1042,
  to: {
    name: 'Jane Doe',
    line1: '116 Marine Dr',
    city: 'Graford',
    state: 'TX',
    pincode: '76449',
    country: 'US',
    phone: '+1 940 282 5665',
    email: 'jane@example.com',
  },
  from: {
    name: 'Waimers',
    line1: 'Plot 4, HSIIDC Industrial Estate, Kundli, near the toll plaza on NH 44',
    city: 'Sonipat',
    state: 'HR',
    pincode: '131028',
    country: 'IN',
    phone: '09999999998',
  },
  lines: [
    {
      title: 'Maboroshi mousepad',
      quantity: 2,
      unitPricePaise: 199900,
      hsCode: '3926.90.99',
      sku: 'MP-01',
      unitWeightGrams: 300,
    },
    { title: 'Desk mat', quantity: 1, unitPricePaise: 99900, hsCode: '39269099' },
  ],
  paymentMode: 'prepaid',
  codAmountPaise: 0,
  valuePaise: 499700,
  weightGrams: 1200,
  dimensionsCm: { length: 30.2, width: 20, height: 4 },
  exporterGstin: '06ABCDE1234F1Z5',
}

const provider = (routes: Record<string, Route>) => {
  const f = fakeFetch(routes)
  return { p: new ShipglobalProvider({ ...config, fetchImpl: f.impl }), calls: f.calls }
}

const basic = `Basic ${Buffer.from('waimers-api:not-a-real-password').toString('base64')}`

describeShippingProvider('shipglobal', {
  create: () =>
    new ShipglobalProvider({
      ...config,
      fetchImpl: fakeFetch({
        '/apiv1/rates/calculate': () => json(RATES_OK),
        '/apiv1/order/add': () => json(ADD_OK),
        '/apiv1/order/getLabel': () => json(LABEL_OK),
        '/apiv1/tools/tracking': () => json(TRACKING_OK),
        '/apiv1/order/cancelRefundOrder': () =>
          json({ success: true, msg: 'Order Cancelled Successfully' }),
      }).impl,
    }),
})

describe('ShipglobalProvider sign-in', () => {
  it('calls the vendor API on app.shipglobal.in with HTTP Basic auth', async () => {
    const { p, calls } = provider({ '/apiv1/rates/calculate': () => json(RATES_OK) })
    const check = await p.verifyCredentials()
    expect(check.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url.href).toBe(`${SHIPGLOBAL_API_URL}/apiv1/rates/calculate`)
    expect(SHIPGLOBAL_API_URL).toBe('https://app.shipglobal.in')
    expect(headerOf(calls[0]?.init, 'Authorization')).toBe(basic)
    expect(calls[0]?.init?.method).toBe('POST')
  })

  it('says the login is wrong only when ShipGlobal answers EA_401', async () => {
    const { p } = provider({ '/apiv1/rates/calculate': () => json(AUTH_FAILED, 401) })
    const check = await p.verifyCredentials()
    expect(check.ok).toBe(false)
    expect(check.message).toMatch(/did not accept this API username or password/)
    expect(check.message).not.toContain('not-a-real-password')
  })

  it('treats an EA_401 body on HTTP 200 as a refused login too', async () => {
    const { p } = provider({ '/apiv1/rates/calculate': () => json(AUTH_FAILED) })
    const check = await p.verifyCredentials()
    expect(check.ok).toBe(false)
    expect(check.message).toMatch(/did not accept/)
  })

  it('shows ShipGlobal’s own words with a refused login', async () => {
    const { p } = provider({ '/apiv1/rates/calculate': () => json(AUTH_FAILED, 401) })
    const check = await p.verifyCredentials()
    expect(check.message).toContain(
      'ShipGlobal answered HTTP 401 EA_401: "Authorization Failed, Invalid Username/Password Combination"',
    )
  })

  it('says the request was turned away, not the login, on a 403 page with no JSON', async () => {
    const { p } = provider({
      '/apiv1/rates/calculate': () => new Response('<html>Access denied</html>', { status: 403 }),
    })
    const check = await p.verifyCredentials()
    expect(check.ok).toBe(false)
    expect(check.message).not.toMatch(/did not accept/)
    expect(check.message).toMatch(/turned our request away \(HTTP 403/)
  })

  it('does not blame the login when ShipGlobal is down', async () => {
    const { p } = provider({
      '/apiv1/rates/calculate': () => new Response('oops', { status: 502 }),
    })
    const check = await p.verifyCredentials()
    expect(check.ok).toBe(false)
    expect(check.message).not.toMatch(/did not accept/)
  })

  it('throws an auth CourierError on bookings with a refused login', async () => {
    const { p } = provider({ '/apiv1/order/add': () => json(AUTH_FAILED, 401) })
    const err = await p.createShipment(exportShipment).catch((e) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect((err as CourierError).kind).toBe('auth')
  })
})

describe('ShipglobalProvider rates', () => {
  it('asks for the parcel in kg and lists every service in paise', async () => {
    const { p, calls } = provider({ '/apiv1/rates/calculate': () => json(RATES_OK) })
    const options = await p.quoteOptions({
      originPincode: '131028',
      destinationPincode: '76449',
      destinationCountry: 'us',
      weightGrams: 1200,
      declaredValuePaise: 499700,
      paymentMode: 'prepaid',
    })
    expect(bodyOf(calls[0]?.init)).toEqual({
      package_weight: '1.2',
      country_iso_code_2: 'US',
      postcode: '76449',
    })
    expect(options).toEqual([
      {
        serviceId: 'ShipGlobal Direct',
        serviceLabel: 'ShipGlobal Direct',
        carrier: null,
        pricePaise: 130000,
        minTransitDays: 7,
        maxTransitDays: 10,
        codAvailable: false,
        charges: [
          { kind: 'freight', pricePaise: 128500 },
          { kind: 'other', pricePaise: 1500 },
        ],
        chargeableWeightGrams: 1200,
      },
      {
        serviceId: 'UPS',
        serviceLabel: 'UPS',
        carrier: 'UPS',
        pricePaise: 224700,
        minTransitDays: 4,
        maxTransitDays: 7,
        codAvailable: false,
        charges: [{ kind: 'freight', pricePaise: 224700 }],
        chargeableWeightGrams: 1200,
      },
    ])
  })

  it('quotes the configured service, or the cheapest when it is not offered', async () => {
    const { p } = provider({ '/apiv1/rates/calculate': () => json(RATES_OK) })
    const query = {
      originPincode: '131028',
      destinationPincode: '76449',
      destinationCountry: 'US',
      weightGrams: 1200,
      declaredValuePaise: 499700,
      paymentMode: 'prepaid' as const,
    }
    expect(await p.quoteRate(query)).toEqual({
      pricePaise: 130000,
      minTransitDays: 7,
      maxTransitDays: 10,
    })
  })

  it('quotes nothing for India or cash on delivery', async () => {
    const { p, calls } = provider({ '/apiv1/rates/calculate': () => json(RATES_OK) })
    const base = {
      originPincode: '131028',
      destinationPincode: '76449',
      weightGrams: 1200,
      declaredValuePaise: 499700,
    }
    expect(await p.quoteOptions({ ...base, paymentMode: 'prepaid' })).toEqual([])
    expect(await p.quoteOptions({ ...base, destinationCountry: 'US', paymentMode: 'cod' })).toEqual(
      [],
    )
    expect(calls).toHaveLength(0)
  })
})

describe('ShipglobalProvider order payload', () => {
  it('maps the order to the documented order/add fields', () => {
    const p = new ShipglobalProvider({ ...config, iossNumber: 'IM1234567890' })
    const { payload } = p.buildOrderPayload({ ...exportShipment, serviceId: 'UPS' })
    expect(payload).toMatchObject({
      invoice_no: '1042',
      invoice_date: '2026-10-31',
      order_reference: exportShipment.orderId,
      service: 'UPS',
      package_weight: '1.2',
      package_length: '31',
      package_breadth: '20',
      package_height: '4',
      currency_code: 'INR',
      csb5_status: 1,
      address_nickname: '',
      customer_shipping_firstname: 'Jane',
      customer_shipping_lastname: 'Doe',
      customer_shipping_email: 'jane@example.com',
      customer_shipping_address: '116 Marine Dr',
      customer_shipping_address_2: 'Graford',
      customer_shipping_city: 'Graford',
      customer_shipping_postcode: '76449',
      customer_shipping_country_code: 'US',
      customer_shipping_state: 'TX',
      ioss_number: 'IM1234567890',
    })
    expect(payload.vendor_order_items).toEqual([
      {
        vendor_order_item_name: 'Maboroshi mousepad',
        vendor_order_item_sku: 'MP-01',
        vendor_order_item_quantity: '2',
        vendor_order_item_unit_price: '1999',
        vendor_order_item_hsn: '39269099',
        vendor_order_item_tax_rate: '0',
      },
      {
        vendor_order_item_name: 'Desk mat',
        vendor_order_item_sku: 'LINE-2',
        vendor_order_item_quantity: '1',
        vendor_order_item_unit_price: '999',
        vendor_order_item_hsn: '39269099',
        vendor_order_item_tax_rate: '0',
      },
    ])
    expect(payload).not.toHaveProperty('customer_nickname')
  })

  it('books the configured service when the rate table picked none, and sends the nicknames', () => {
    const p = new ShipglobalProvider({
      ...config,
      addressNickname: 'Kundli',
      customerNickname: 'franchise-7',
    })
    const { payload } = p.buildOrderPayload(exportShipment)
    expect(payload.service).toBe('ShipGlobal Direct')
    expect(payload.address_nickname).toBe('Kundli')
    expect(payload.customer_nickname).toBe('franchise-7')
  })

  it('needs an HS code on every line, with the shared message', () => {
    const p = new ShipglobalProvider(config)
    expect(() =>
      p.buildOrderPayload({
        ...exportShipment,
        lines: [{ title: 'Mystery box', quantity: 1, unitPricePaise: 100 }],
      }),
    ).toThrow(/HS code/)
  })
})

describe('ShipglobalProvider booking', () => {
  it('adds the order, pays for the label and returns its tracking number and PDF', async () => {
    const { p, calls } = provider({
      '/apiv1/order/add': () => json(ADD_OK),
      '/apiv1/order/getLabel': () => json(LABEL_OK),
    })
    const result = await p.createShipment(exportShipment)
    expect(result).toEqual({
      waybill: 'SG32607086295274',
      providerRef: 'SG32607086295274',
      trackingUrl: SHIPGLOBAL_TRACKING_PAGE,
      documents: [{ kind: 'label', pdfBase64: 'JVBERi0xLjQK' }],
    })
    expect(calls.map((c) => c.url.pathname)).toEqual(['/apiv1/order/add', '/apiv1/order/getLabel'])
    expect(bodyOf(calls[1]?.init)).toEqual({ tracking: 'SG32607086295274', label: true })
    for (const c of calls) expect(headerOf(c.init, 'Authorization')).toBe(basic)
  })

  it('reads the tracking number from a nested data object too', async () => {
    const { p } = provider({
      '/apiv1/order/add': () => json({ success: true, data: { tracking: 'SG111' } }),
      '/apiv1/order/getLabel': () => json({ ...LABEL_OK, tracking: 'SG111' }),
    })
    expect((await p.createShipment(exportShipment)).waybill).toBe('SG111')
  })

  it('reads the reason from a refused order', async () => {
    const { p } = provider({
      '/apiv1/order/add': () =>
        json({ success: false, error: 'Invoice number already exists', error_code: 'E2' }),
    })
    await expect(p.createShipment(exportShipment)).rejects.toThrow(
      /ShipGlobal: Invoice number already exists/,
    )
  })

  it('names the saved order when the label is not paid for', async () => {
    const { p } = provider({
      '/apiv1/order/add': () => json(ADD_OK),
      '/apiv1/order/getLabel': () => json({ success: false, error: 'Insufficient wallet balance' }),
    })
    const err = await p.createShipment(exportShipment).catch((e) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect(err.message).toContain('SG32607086295274')
    expect(err.message).toContain('Insufficient wallet balance')
  })

  it('refuses India and COD without calling ShipGlobal', async () => {
    const { p, calls } = provider({})
    await expect(
      p.createShipment({ ...exportShipment, to: { ...exportShipment.to, country: 'IN' } }),
    ).rejects.toThrow(/other countries only/)
    await expect(p.createShipment({ ...exportShipment, paymentMode: 'cod' })).rejects.toThrow(
      /cash on delivery/,
    )
    expect(calls).toHaveLength(0)
  })

  it('turns an HTML error page into a CourierError', async () => {
    const { p } = provider({
      '/apiv1/order/add': () => new Response('<html>Bad gateway</html>', { status: 502 }),
    })
    const err = await p.createShipment(exportShipment).catch((e) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect((err as CourierError).kind).toBe('unavailable')
  })
})

describe('ShipglobalProvider tracking and cancel', () => {
  it('tracks automatically, oldest event first, status from the newest', async () => {
    const { p, calls } = provider({ '/apiv1/tools/tracking': () => json(TRACKING_OK) })
    expect(p.tracksManually).toBe(false)
    const t = await p.track('SG3240206590212')
    expect(bodyOf(calls[0]?.init)).toEqual({ tracking: 'SG3240206590212' })
    expect(t.status).toBe('delivered')
    expect(t.events.map((e) => e.status)).toEqual(['in_transit', 'out_for_delivery', 'delivered'])
    expect(t.events[0]).toEqual({
      at: '2023-09-30T12:37:00.000Z',
      status: 'in_transit',
      description: 'Shipment Cleared & Handed Over for Connection',
      location: 'USA',
    })
    expect(t.trackingUrl).toBe(SHIPGLOBAL_TRACKING_PAGE)
  })

  it('reads returns and early scans', async () => {
    const event = (code: string, at: string) => ({
      awb_history_datetime: at,
      awb_history_location: '',
      awb_history_comment: code,
      awb_event_code: code,
    })
    const { p } = provider({
      '/apiv1/tools/tracking': () =>
        json({
          success: true,
          data: {
            awbEvents: [
              event('SGE_504', '2026-11-05 10:00:00'),
              event('SGE_104', '2026-11-01 10:00:00'),
              event('SGE_001', '2026-10-31 10:00:00'),
            ],
          },
        }),
    })
    const t = await p.track('SG1')
    expect(t.events.map((e) => e.status)).toEqual(['created', 'picked_up', 'rto'])
    expect(t.status).toBe('rto')
  })

  it('cancels and refunds, and takes "already cancelled" as done', async () => {
    const { p, calls } = provider({
      '/apiv1/order/cancelRefundOrder': () =>
        json({ success: true, msg: 'Order Already Cancelled' }),
    })
    await expect(p.cancel('SG32407261079582')).resolves.toBeUndefined()
    expect(bodyOf(calls[0]?.init)).toEqual({ tracking: 'SG32407261079582' })
  })

  it('shows ShipGlobal’s reason when it will not cancel', async () => {
    const { p } = provider({
      '/apiv1/order/cancelRefundOrder': () =>
        json({ success: false, error: 'Shipment already picked up' }),
    })
    await expect(p.cancel('SG1')).rejects.toThrow(/ShipGlobal: Shipment already picked up/)
  })
})

describe('ShipglobalProvider serviceability', () => {
  it('ships abroad, prepaid only, and never inside India', async () => {
    const p = new ShipglobalProvider(config)
    const abroad = await p.checkServiceability({
      originPincode: '131028',
      destinationPincode: '76449',
      destinationCountry: 'US',
    })
    expect(abroad).toMatchObject({ serviceable: true, codAvailable: false, prepaidAvailable: true })
    const home = await p.checkServiceability({
      originPincode: '131028',
      destinationPincode: '110001',
    })
    expect(home.serviceable).toBe(false)
  })
})

describe('shipglobalFactory', () => {
  const form = {
    username: ' waimers-api ',
    password: 'not-a-real-password',
    addressNickname: ' Kundli ',
    originPincode: '131028',
    originCity: 'Sonipat',
    iec: 'abcde1234f',
    iossNumber: '',
    service: 'UPS',
  }

  it('validates and normalises the connect form', () => {
    expect(shipglobalFactory.validateConfig(form)).toEqual({
      ok: true,
      config: {
        username: 'waimers-api',
        password: 'not-a-real-password',
        addressNickname: 'Kundli',
        customerNickname: undefined,
        originPincode: '131028',
        originCity: 'Sonipat',
        iec: 'ABCDE1234F',
        iossNumber: undefined,
        service: 'UPS',
      },
    })
  })

  it('reads a login saved before the rewrite (email key, old service code)', () => {
    const saved = {
      email: 'ops@example.com',
      password: 'pw',
      sellerNickname: 'Waimers',
      originPincode: '131028',
      originCity: 'Sonipat',
      service: 'DHLECS',
    }
    const result = shipglobalFactory.validateConfig(saved)
    expect(result).toMatchObject({
      ok: true,
      config: { username: 'ops@example.com', service: 'ShipGlobal Direct' },
    })
  })

  it('says what is wrong', () => {
    const result = shipglobalFactory.validateConfig({ ...form, username: '', originPincode: '12' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('API username is required')
      expect(result.errors).toContain('origin PIN code must be 6 digits')
    }
  })

  it('marks the password secret and offers rates, tracking and cancel', () => {
    expect(shipglobalFactory.fields.find((f) => f.key === 'password')?.secret).toBe(true)
    expect(shipglobalFactory.capabilities).toEqual(
      expect.arrayContaining(['rates', 'create_shipment', 'label', 'tracking', 'cancel']),
    )
  })
})
