import { CourierError, type CreateShipmentInput } from '@commerce/shipping'
import { describeShippingProvider } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { SHIPGLOBAL_API_URL, SHIPGLOBAL_TRACKING_PAGE } from '../src/client'
import { shipglobalFactory } from '../src/factory'
import { shipglobalService, tokenLifetimeMs } from '../src/mapping'
import { ShipglobalProvider } from '../src/shipglobal'

/* Fixtures are shaped from the samples on https://labels.shipglobal.in/api-docs.php. */

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

const LOGIN_OK = {
  token: 'sg-token-1',
  expires_at: '2026-10-31 18:00:00',
  customer: { id: 1, name: 'Waimers', email: 'ops@example.com' },
}

const LABEL_OK = {
  success: true,
  label: 'generated',
  error: '',
  data: {
    order_number: 'ABCD12345678',
    waybill_number: 'UUS123456789012',
    pdf_base64: 'JVBERi0xLjQK',
    label_format: 'PDF',
  },
}

const config = {
  email: 'ops@example.com',
  password: 'not-a-real-password',
  sellerNickname: 'Waimers',
  originPincode: '131028',
  originCity: 'Sonipat',
  iec: 'ABCDE1234F',
  iossNumber: undefined,
  service: 'DHLECS' as const,
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

describeShippingProvider('shipglobal', {
  create: () =>
    new ShipglobalProvider({
      ...config,
      fetchImpl: fakeFetch({ '/customers.php': () => json(LOGIN_OK) }).impl,
    }),
})

describe('ShipglobalProvider login', () => {
  it('signs in with the API login and books with the bearer token, once', async () => {
    const { p, calls } = provider({
      '/customers.php': () => json(LOGIN_OK),
      '/addOrder.php': () => json(LABEL_OK),
    })
    await p.createShipment(exportShipment)
    await p.createShipment(exportShipment)
    const logins = calls.filter((c) => c.url.pathname.endsWith('/customers.php'))
    expect(logins).toHaveLength(1)
    expect(logins[0]?.url.href).toBe(`${SHIPGLOBAL_API_URL}/customers.php`)
    expect(bodyOf(logins[0]?.init)).toEqual({
      email: 'ops@example.com',
      password: 'not-a-real-password',
    })
    const order = calls.find((c) => c.url.pathname.endsWith('/addOrder.php'))
    expect(headerOf(order?.init, 'Authorization')).toBe('Bearer sg-token-1')
    expect(order?.url.searchParams.get('download')).toBe('true')
  })

  it('signs in again once when the token is refused', async () => {
    let orders = 0
    const { p, calls } = provider({
      '/customers.php': () => json(LOGIN_OK),
      '/addOrder.php': () => (++orders === 1 ? json({ error: 'expired' }, 401) : json(LABEL_OK)),
    })
    const r = await p.createShipment(exportShipment)
    expect(r.waybill).toBe('UUS123456789012')
    expect(calls.filter((c) => c.url.pathname.endsWith('/customers.php'))).toHaveLength(2)
  })

  it('reads expires_at as India time and falls back to an hour', () => {
    expect(tokenLifetimeMs('2026-10-31 18:00:00', NOW)).toBe(6 * 60 * 60 * 1000)
    expect(tokenLifetimeMs('soon', NOW)).toBe(60 * 60 * 1000)
    expect(tokenLifetimeMs('2026-10-30 18:00:00', NOW)).toBe(60 * 60 * 1000)
  })

  it('verifyCredentials names the account and never echoes the password', async () => {
    const { p } = provider({ '/customers.php': () => json(LOGIN_OK) })
    const ok = await p.verifyCredentials()
    expect(ok).toEqual({ ok: true, message: expect.stringContaining('as Waimers') })

    const bad = provider({ '/customers.php': () => json({ error: 'Invalid credentials' }, 401) })
    const refused = await bad.p.verifyCredentials()
    expect(refused.ok).toBe(false)
    expect(refused.message).toContain('Settings › API')
    expect(refused.message).not.toContain('not-a-real-password')

    const noToken = provider({ '/customers.php': () => json({ message: 'Invalid' }) })
    expect((await noToken.p.verifyCredentials()).ok).toBe(false)
  })
})

describe('ShipglobalProvider order payload', () => {
  it('maps the order to the documented addOrder fields', () => {
    const { p } = provider({})
    const { service, payload } = p.buildOrderPayload(exportShipment)
    expect(service).toBe('DHLECS')
    expect(payload).toMatchObject({
      invoice_no: '1042',
      invoice_date: '2026-10-31',
      order_reference: exportShipment.orderId,
      service: 'DHLECS',
      package_weight: 1200,
      package_length: 31,
      package_breadth: 20,
      package_height: 4,
      currency_code: 'INR',
      csb5_status: 1,
      seller_nickname: 'Waimers',
      seller_firstname: 'Waimers',
      seller_lastname: 'Waimers',
      seller_mobile: '+919999999998',
      seller_email: 'ops@example.com',
      seller_city: 'Sonipat',
      seller_postcode: '131028',
      seller_country_code: 'IN',
      seller_state: 'HR',
      seller_tax_id_type: 'GSTIN',
      seller_tax_id: '06ABCDE1234F1Z5',
      iec_number: 'ABCDE1234F',
      customer_shipping_firstname: 'Jane',
      customer_shipping_lastname: 'Doe',
      customer_shipping_mobile: '+19402825665',
      customer_shipping_address: '116 Marine Dr',
      customer_shipping_address_2: 'Graford',
      customer_shipping_city: 'Graford',
      customer_shipping_postcode: '76449',
      customer_shipping_country_code: 'US',
      customer_shipping_state: 'TX',
      retry: false,
    })
    expect(payload.vendor_order_items).toEqual([
      {
        vendor_order_item_name: 'Maboroshi mousepad',
        vendor_order_item_sku: 'MP-01',
        vendor_order_item_quantity: 2,
        vendor_order_item_unit_price: 1999,
        vendor_order_item_hsn: '39269099',
        vendor_order_item_tax_rate: 0,
      },
      {
        vendor_order_item_name: 'Desk mat',
        vendor_order_item_sku: 'LINE-2',
        vendor_order_item_quantity: 1,
        vendor_order_item_unit_price: 999,
        vendor_order_item_hsn: '39269099',
        vendor_order_item_tax_rate: 0,
      },
    ])
    expect(payload.seller_address.length).toBeLessThanOrEqual(50)
    expect(payload.seller_address_2.length).toBeGreaterThan(0)
    expect(payload).not.toHaveProperty('mailClass')
    expect(payload).not.toHaveProperty('ioss_number')
  })

  it('needs an HS code on every line, with the shared message', () => {
    const { p } = provider({})
    const input = {
      ...exportShipment,
      lines: [{ title: 'Keycap set', quantity: 1, unitPricePaise: 100000 }],
    }
    expect(() => p.buildOrderPayload(input)).toThrow(/needs an HS code on every item.*Keycap set/)
  })

  it('splits the US pair by weight and adds VipParcel’s extra fields', () => {
    expect(shipglobalService(undefined, 'USPS', 'US', 5000)).toBe('USPS')
    expect(shipglobalService(undefined, 'USPS', 'US', 5001)).toBe('UPS')
    expect(shipglobalService('UPS', 'DHLECS', 'us', 800)).toBe('USPS')
    expect(shipglobalService(undefined, 'USPS', 'GB', 800)).toBeNull()
    expect(shipglobalService('nope', 'DPD', 'DE', 800)).toBe('DPD')

    const vip = new ShipglobalProvider({ ...config, service: 'VIPPARCEL' })
    expect(vip.buildOrderPayload(exportShipment).payload).toMatchObject({
      mailClass: 'First',
      deliveryConfirmation: 'NO_SIGNATURE',
    })
  })
})

describe('ShipglobalProvider booking', () => {
  it('returns the waybill, ShipGlobal’s order number and the PDF label', async () => {
    const { p } = provider({
      '/customers.php': () => json(LOGIN_OK),
      '/addOrder.php': () => json(LABEL_OK),
    })
    await expect(p.createShipment(exportShipment)).resolves.toEqual({
      waybill: 'UUS123456789012',
      providerRef: 'ABCD12345678',
      trackingUrl: SHIPGLOBAL_TRACKING_PAGE,
      documents: [{ kind: 'label', pdfBase64: 'JVBERi0xLjQK' }],
    })
  })

  it('reads the reason from a refused booking that still answers 200', async () => {
    const { p } = provider({
      '/customers.php': () => json(LOGIN_OK),
      '/addOrder.php': () =>
        json({
          success: false,
          label: 'manual',
          error: 'UPS is allowed only above 5 KG; use USPS for this shipment',
          data: {
            order_number: 'ABCD12345678',
            waybill_number: '',
            pdf_base64: '',
            label_format: 'PDF',
          },
        }),
    })
    await expect(p.createShipment(exportShipment)).rejects.toThrow(
      'ShipGlobal: UPS is allowed only above 5 KG; use USPS for this shipment',
    )
  })

  it('keeps a UPS booking but drops its GIF label', async () => {
    const { p } = provider({
      '/customers.php': () => json(LOGIN_OK),
      '/addOrder.php': () => json({ ...LABEL_OK, data: { ...LABEL_OK.data, label_format: 'GIF' } }),
    })
    const r = await p.createShipment(exportShipment)
    expect(r.waybill).toBe('UUS123456789012')
    expect(r.documents).toBeUndefined()
  })

  it('refuses India, COD, and a US-only service abroad without calling ShipGlobal', async () => {
    const { p, calls } = provider({})
    await expect(
      p.createShipment({ ...exportShipment, to: { ...exportShipment.to, country: 'IN' } }),
    ).rejects.toBeInstanceOf(CourierError)
    await expect(p.createShipment({ ...exportShipment, paymentMode: 'cod' })).rejects.toThrow(
      /cash on delivery/,
    )
    const usps = new ShipglobalProvider({
      ...config,
      service: 'USPS',
      fetchImpl: fakeFetch({}).impl,
    })
    await expect(
      usps.createShipment({ ...exportShipment, to: { ...exportShipment.to, country: 'GB' } }),
    ).rejects.toThrow(/US only/)
    expect(calls).toHaveLength(0)
  })

  it('turns an HTML error page into a CourierError', async () => {
    const { p } = provider({
      '/customers.php': () => json(LOGIN_OK),
      '/addOrder.php': () => new Response('<html>Bad gateway</html>', { status: 502 }),
    })
    await expect(p.createShipment(exportShipment)).rejects.toMatchObject({ kind: 'unavailable' })
  })
})

describe('ShipglobalProvider serviceability and tracking', () => {
  it('answers from the service rules without a call: abroad yes, India no, prepaid only', async () => {
    const { p, calls } = provider({})
    const abroad = await p.checkServiceability({
      originPincode: '131028',
      destinationPincode: '76449',
      destinationCountry: 'US',
    })
    expect(abroad).toMatchObject({ serviceable: true, codAvailable: false, minTransitDays: null })
    const home = await p.checkServiceability({
      originPincode: '131028',
      destinationPincode: '110001',
    })
    expect(home.serviceable).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('tracks by hand: the poll job is kept away and track explains why', async () => {
    const { p } = provider({})
    expect(p.tracksManually).toBe(true)
    await expect(p.track('UUS1')).rejects.toThrow(/shipglobal.in\/tracking/)
  })
})

describe('shipglobalFactory', () => {
  const raw = {
    email: ' ops@example.com ',
    password: 'not-a-real-password',
    sellerNickname: 'Waimers',
    originPincode: '131028',
    originCity: 'Sonipat',
    iec: 'abcde1234f',
    iossNumber: 'im1234567890',
    service: 'dpd',
  }

  it('validates and normalises the connect form', () => {
    const r = shipglobalFactory.validateConfig(raw)
    expect(r).toMatchObject({
      ok: true,
      config: {
        email: 'ops@example.com',
        iec: 'ABCDE1234F',
        iossNumber: 'IM1234567890',
        service: 'DPD',
      },
    })
    expect(shipglobalFactory.validateConfig({ ...raw, service: '' })).toMatchObject({
      ok: true,
      config: { service: 'DHLECS' },
    })
  })

  it('says what is wrong', () => {
    const r = shipglobalFactory.validateConfig({
      ...raw,
      email: 'nope',
      originPincode: '12',
      service: 'FEDEX',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors).toHaveLength(3)
  })

  it('marks the password secret', () => {
    expect(shipglobalFactory.fields.find((f) => f.key === 'password')?.secret).toBe(true)
  })
})
