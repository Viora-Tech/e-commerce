import { sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { orderAmounts } from '../src/amounts'
import { bookedService, chargeOf } from '../src/booked'
import { ShiprocketProvider } from '../src/shiprocket'

type Route = (init?: RequestInit) => Response

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A fetch that records every call and answers from a route table (no real Shiprocket call). */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { path: string; body: unknown }[] = []
  const impl: typeof fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input))
    calls.push({ path: url.pathname, body: init?.body ? JSON.parse(init.body as string) : null })
    const route = Object.entries(routes).find(([p]) => url.pathname.endsWith(p))?.[1]
    return route ? route(init) : new Response('not found', { status: 404 })
  }
  return { impl, calls }
}

const config = {
  email: 'api-user@waimers.example',
  password: 'secret',
  pickupLocationName: 'Waimers Sonipat',
  originPincode: '131028',
}

const booking = (extra: Record<string, Route> = {}) => ({
  '/auth/login': () => json({ token: 'tok' }),
  '/orders/create/adhoc': () => json({ order_id: 555, shipment_id: 777 }),
  '/courier/assign/awb': () =>
    json({
      awb_assign_status: 1,
      response: {
        data: { awb_code: 'SR9', courier_company_id: 217, courier_name: 'Blue Dart Surface' },
      },
    }),
  '/courier/generate/label': () => json({ label_url: 'https://labels/777.pdf' }),
  '/courier/generate/pickup': () => json({ pickup_status: 0 }),
  ...extra,
})

/** Shiprocket's total: sub_total + shipping + transaction - discount (rupees). */
const total = (a: ReturnType<typeof orderAmounts>) =>
  Math.round((a.sub_total + a.shipping_charges + a.transaction_charges - a.total_discount) * 100)

const mousepad = [{ title: 'Mousepad', quantity: 2, unitPricePaise: 99900 }]

describe('orderAmounts (Shiprocket COD collect)', () => {
  it('prepaid: items plus shipping come to the parcel value', () => {
    const a = orderAmounts({
      lines: mousepad,
      paymentMode: 'prepaid',
      codAmountPaise: 0,
      valuePaise: 209800,
    })
    expect(a).toEqual({
      sub_total: 1998,
      shipping_charges: 100,
      transaction_charges: 0,
      total_discount: 0,
    })
    expect(total(a)).toBe(209800)
  })

  it('COD with a coupon and a COD fee collects the COD amount typed', () => {
    // ₹1,998 items, ₹200 coupon (value ₹1,798), ₹49 COD fee on top.
    const a = orderAmounts({
      lines: mousepad,
      paymentMode: 'cod',
      codAmountPaise: 184700,
      valuePaise: 179800,
    })
    expect(a).toEqual({
      sub_total: 1998,
      shipping_charges: 0,
      transaction_charges: 49,
      total_discount: 200,
    })
    expect(total(a)).toBe(184700)
  })

  it('COD with part paid by store credit leaves out the part paid', () => {
    // ₹1,998 items + ₹79 shipping = ₹2,077; ₹500 store credit already taken.
    const a = orderAmounts({
      lines: mousepad,
      paymentMode: 'cod',
      codAmountPaise: 157700,
      valuePaise: 207700,
    })
    expect(a).toEqual({
      sub_total: 1998,
      shipping_charges: 79,
      transaction_charges: 0,
      total_discount: 500,
    })
    expect(total(a)).toBe(157700)
  })
})

describe('Shiprocket order create sends the amounts', () => {
  it('a COD booking sends COD with sub_total, shipping, fee and discount', async () => {
    const f = fakeFetch(booking())
    await new ShiprocketProvider({ ...config, fetchImpl: f.impl }).createShipment({
      ...sampleShipment,
      paymentMode: 'cod',
      codAmountPaise: 150000,
      valuePaise: 199900,
    })
    expect(f.calls.find((c) => c.path.endsWith('/orders/create/adhoc'))?.body).toMatchObject({
      payment_method: 'COD',
      sub_total: 1999,
      shipping_charges: 0,
      transaction_charges: 0,
      total_discount: 499,
    })
  })
})

describe('Shiprocket booking truth', () => {
  it('returns the courier Shiprocket assigned and the charge it lists for the AWB', async () => {
    const f = fakeFetch(
      booking({
        '/orders/show/555': () =>
          json({
            data: { awb_data: { charges: { freight_charges: '74.47', cod_charges: '35' } } },
          }),
      }),
    )
    const r = await new ShiprocketProvider({ ...config, fetchImpl: f.impl }).createShipment({
      ...sampleShipment,
      serviceId: '42',
    })
    expect(r).toMatchObject({
      waybill: 'SR9',
      bookedService: { id: '217', label: 'Blue Dart Surface' },
      chargePaise: 10947,
    })
  })

  it('books without a charge when Shiprocket has none yet or the read fails', async () => {
    for (const show of [
      () => json({ data: { awb_data: { charges: { freight_charges: '' } } } }),
      () => json({ message: 'boom' }, 500),
    ]) {
      const f = fakeFetch(booking({ '/orders/show/555': show }))
      const r = await new ShiprocketProvider({ ...config, fetchImpl: f.impl }).createShipment(
        sampleShipment,
      )
      expect(r.waybill).toBe('SR9')
      expect(r.chargePaise).toBeUndefined()
    }
  })

  it('reads a pushed order’s charge by Shiprocket’s own order id, never our UUID', async () => {
    const f = fakeFetch(
      booking({
        '/orders/show/901': () =>
          json({ data: { awb_data: { charges: { applied_weight_amount: 62 } } } }),
      }),
    )
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    const pushed = await p.createShipment({
      ...sampleShipment,
      pushed: { externalOrderId: '901', externalShipmentId: '777' },
    })
    expect(pushed.chargePaise).toBe(6200)
    const g = fakeFetch(booking())
    await new ShiprocketProvider({ ...config, fetchImpl: g.impl }).createShipment({
      ...sampleShipment,
      pushed: { externalOrderId: 'conformance-order', externalShipmentId: '777' },
    })
    expect(g.calls.some((c) => c.path.includes('/orders/show/'))).toBe(false)
  })

  it('never saves its rate quote as the charge', () => {
    expect(new ShiprocketProvider(config).quoteIsCharge).toBe(false)
  })

  it('reads the assigned courier and the charge defensively', () => {
    expect(bookedService(undefined)).toEqual({})
    expect(bookedService({ courier_name: ' Xpressbees ' })).toEqual({
      bookedService: { label: 'Xpressbees' },
    })
    expect(chargeOf(undefined)).toBeUndefined()
    expect(chargeOf({ data: { awb_data: null } })).toBeUndefined()
  })
})
