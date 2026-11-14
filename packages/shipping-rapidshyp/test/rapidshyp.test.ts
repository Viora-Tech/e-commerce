import { CourierError, courierOrderRef, describeCourierFailureForStaff } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { eddDaysFromToday } from '../src/edd'
import { RapidshypProvider, rapidshypFactory } from '../src/rapidshyp'
import { explainRapidshypRemark, rapidshypRefusal } from '../src/remarks'
import { mapRapidshypStatus } from '../src/status'

/** A date N days ahead on India's calendar, as RapidShyp writes it (DD-MM-YYYY). */
const istDaysAhead = (n: number) => {
  const d = new Date(Date.now() + 5.5 * 3600_000 + n * 86400000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`
}

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
                edd: istDaysAhead(5),
              },
            ]
          : [
              {
                courier_code: 'A',
                courier_name: 'Courier A',
                total_freight: 60,
                edd: istDaysAhead(3),
              },
              {
                courier_code: 'B',
                courier_name: 'Courier B',
                total_freight: 90,
                edd: istDaysAhead(5),
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

  it('asks serviceability with and without COD at once, not one after the other (#1524)', async () => {
    let open = 0
    let peak = 0
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': async () => {
        open += 1
        peak = Math.max(peak, open)
        await new Promise((r) => setTimeout(r, 10))
        open -= 1
        return json({
          status: true,
          serviceable_courier_list: [{ courier_code: 'A', total_freight: 60 }],
        })
      },
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(peak).toBe(2)
  })

  it('checkout’s three asks share two calls: prepaid rates, COD rates and serviceability (#1524)', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': async () => {
        await new Promise((r) => setTimeout(r, 10))
        return json({
          status: true,
          serviceable_courier_list: [{ courier_code: 'A', total_freight: 60 }],
        })
      },
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const rate = (paymentMode: 'prepaid' | 'cod') => ({
      originPincode: '131028',
      destinationPincode: '560001',
      weightGrams: 500,
      declaredValuePaise: 199_900,
      paymentMode,
    })
    await Promise.all([
      p.quoteOptions(rate('prepaid')),
      p.quoteOptions(rate('cod')),
      p.checkServiceability({
        originPincode: '131028',
        destinationPincode: '560001',
        weightGrams: 500,
        declaredValue: 1999,
      }),
    ])
    const bodies = f.calls.map((c) => c.init?.body)
    expect(bodies).toHaveLength(2) // was 6
    expect(new Set(bodies).size).toBe(2)
    // A later ask is a fresh call: only calls in flight are shared.
    await p.quoteOptions(rate('prepaid'))
    expect(f.calls).toHaveLength(4)
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

  it('quoteOptions returns every serviceable courier with COD flagged per courier', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/serviceabilty_check': (_url, init) => {
        const body = JSON.parse((init?.body as string) ?? '{}')
        const list = body.cod
          ? [{ courier_code: 'B', courier_name: 'Xpressbees', total_freight: 90 }]
          : [
              {
                courier_code: 'A',
                courier_name: 'Delhivery Surface',
                parent_courier_name: 'Delhivery',
                total_freight: 60,
              },
              { courier_code: 'B', courier_name: 'Xpressbees', total_freight: 90 },
            ]
        return json({ status: true, serviceable_courier_list: list })
      },
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const options = await p.quoteOptions({
      originPincode: '131028',
      destinationPincode: '560001',
      weightGrams: 500,
      declaredValuePaise: 199900,
      paymentMode: 'prepaid',
    })
    expect(options).toHaveLength(2)
    expect(options.find((o) => o.serviceId === 'A')).toMatchObject({
      carrier: 'Delhivery',
      serviceLabel: 'Delhivery Surface',
      pricePaise: 6000,
      codAvailable: false,
    })
    expect(options.find((o) => o.serviceId === 'B')).toMatchObject({
      carrier: 'Xpressbees',
      codAvailable: true,
    })
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

  it('books the picked courier in two steps: create_order with no courier, then assign_awb', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () =>
        json({
          status: 'SUCCESS',
          remarks: 'Order created',
          order_id: '2471',
          shipment: [{ shipment_id: 'ship-1' }],
        }),
      '/rapidshyp/apis/v1/assign_awb': () =>
        json({ status: 'SUCCESS', awb: 'BD-1', courier_code: 'BD', courier_name: 'Blue Dart Air' }),
      '/rapidshyp/apis/v1/schedule_pickup': () => json({ status: 'SUCCESS', awb: 'BD-1' }),
      '/rapidshyp/apis/v1/generate_label': () =>
        json({ status: true, labelData: [{ shipmentId: 'ship-1', labelURL: 'https://l/bd.pdf' }] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      orderNumber: 2471,
      serviceId: 'BD',
      serviceLabel: 'Blue Dart Air',
    })
    expect(r).toEqual({ waybill: 'BD-1', providerRef: '2471', labelUrl: 'https://l/bd.pdf' })

    const paths = f.calls.map((c) => c.url.pathname.split('/').pop())
    // Never the wrapper: it books by the account's courier priority (Amazon Shipping, 14 Nov).
    expect(paths).toEqual(['create_order', 'assign_awb', 'schedule_pickup', 'generate_label'])
    const create = JSON.parse(f.calls[0]?.init?.body as string)
    expect(create).toMatchObject({ orderId: '2471', storeName: 'DEFAULT' })
    expect(create).not.toHaveProperty('courierCode')
    expect(JSON.parse(f.calls[1]?.init?.body as string)).toEqual({
      shipment_id: 'ship-1',
      courier_code: 'BD',
    })
  })

  it('reads the shipment id from a create_order answer of another shape', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () =>
        json({ status: 'SUCCESS', order_id: '2471', shipment: { shipmentId: 77 } }),
      '/rapidshyp/apis/v1/assign_awb': () => json({ awb: 'BD-2' }),
      '/rapidshyp/apis/v1/schedule_pickup': () => json({ status: 'SUCCESS' }),
      '/rapidshyp/apis/v1/generate_label': () => json({ status: true, labelData: [] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({ ...sampleShipment, orderNumber: 2471, serviceId: 'BD' })
    expect(r.waybill).toBe('BD-2')
    const assign = f.calls.find((c) => c.url.pathname.endsWith('/assign_awb'))
    expect(JSON.parse(assign?.init?.body as string)).toMatchObject({ shipment_id: '77' })
  })

  it('cancels the order it just created when RapidShyp refuses the picked courier', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () =>
        json({ status: 'SUCCESS', order_id: '2471', shipment: [{ shipmentId: 'ship-1' }] }),
      '/rapidshyp/apis/v1/assign_awb': () =>
        json({ status: false, remarks: 'Awb can not assign with this shipment id' }, 400),
      '/rapidshyp/apis/v1/cancel_order': () => json({ status: true, remarks: 'cancelled' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const err = await p
      .createShipment({
        ...sampleShipment,
        orderNumber: 2471,
        serviceId: 'BD',
        serviceLabel: 'Blue Dart Air',
      })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect(err).toMatchObject({
      kind: 'rejected',
      reason: 'Awb can not assign with this shipment id',
    })
    const message = (err as CourierError).message
    expect(message).toContain('Blue Dart Air')
    expect(message).toContain('We cancelled order 2471 on RapidShyp')
    expect(message.endsWith('(Awb can not assign with this shipment id)')).toBe(true)

    const cancel = f.calls.find((c) => c.url.pathname.endsWith('/cancel_order'))
    expect(JSON.parse(cancel?.init?.body as string)).toEqual({
      orderId: '2471',
      storeName: 'DEFAULT',
    })
    // No pickup or label for a shipment that never got a courier.
    expect(f.calls.some((c) => c.url.pathname.endsWith('/schedule_pickup'))).toBe(false)
  })

  it('says so when the order it created could not be cancelled either', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () =>
        json({ status: 'SUCCESS', order_id: '2471', shipment: [{ shipmentId: 'ship-1' }] }),
      '/rapidshyp/apis/v1/assign_awb': () => json({ status: 'FAILED', remarks: 'no courier' }),
      '/rapidshyp/apis/v1/cancel_order': () => json({ status: false, remarks: 'nope' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(
      p.createShipment({ ...sampleShipment, orderNumber: 2471, serviceId: 'BD' }),
    ).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('Order 2471 is still on RapidShyp'),
    })
  })

  it('books an order pushed earlier by assigning the picked courier to its shipment', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/assign_awb': () => json({ awb: 'BD-3' }),
      '/rapidshyp/apis/v1/schedule_pickup': () => json({ status: 'SUCCESS' }),
      '/rapidshyp/apis/v1/generate_label': () =>
        json({ status: true, labelData: [{ labelURL: 'https://l/3.pdf' }] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      serviceId: 'BD',
      pushed: { externalOrderId: '2471', externalShipmentId: 'ship-9' },
    })
    expect(r).toEqual({ waybill: 'BD-3', providerRef: '2471', labelUrl: 'https://l/3.pdf' })
    expect(f.calls.some((c) => c.url.pathname.endsWith('/create_order'))).toBe(false)
    expect(f.calls.some((c) => c.url.pathname.endsWith('/wrapper'))).toBe(false)
    const assign = f.calls.find((c) => c.url.pathname.endsWith('/assign_awb'))
    expect(JSON.parse(assign?.init?.body as string)).toEqual({
      shipment_id: 'ship-9',
      courier_code: 'BD',
    })
  })

  it('leaves a pushed order alone when its courier is refused', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/assign_awb': () =>
        json({ status: false, remarks: 'Awb can not assign with this shipment id' }, 400),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(
      p.createShipment({
        ...sampleShipment,
        serviceId: 'BD',
        pushed: { externalOrderId: '2471', externalShipmentId: 'ship-9' },
      }),
    ).rejects.toMatchObject({ kind: 'rejected', message: expect.stringContaining('courier BD') })
    expect(f.calls.some((c) => c.url.pathname.endsWith('/cancel_order'))).toBe(false)
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

describe('RapidshypProvider order ids', () => {
  const created = () =>
    json({
      orderId: 'x',
      orderCreated: true,
      shipment: [{ shipmentId: 's', awb: 'A1', pickupScheduled: true, labelURL: 'https://l' }],
    })
  const sentOrderId = (f: ReturnType<typeof fakeFetch>, i = 0) =>
    JSON.parse(f.calls[i]?.init?.body as string).orderId

  it('sends the order number, not our internal UUID', async () => {
    const f = fakeFetch({ '/rapidshyp/apis/v1/wrapper': created })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await p.createShipment({ ...sampleShipment, orderId: 'b3c1-uuid', orderNumber: 2471 })
    expect(sentOrderId(f)).toBe('2471')
  })

  it('suffixes the order’s later bookings: 2471-2, 2471-3', async () => {
    const f = fakeFetch({ '/rapidshyp/apis/v1/wrapper': created })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await p.createShipment({ ...sampleShipment, orderNumber: 2471, shipmentNumber: 2 })
    await p.createShipment({ ...sampleShipment, orderNumber: 2471, shipmentNumber: 3 })
    expect([sentOrderId(f, 0), sentOrderId(f, 1)]).toEqual(['2471-2', '2471-3'])
  })

  it('moves to the next suffix when RapidShyp already holds the id, and returns what it sent', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': (_url, init) => {
        const { orderId } = JSON.parse(init?.body as string)
        return orderId === '2471'
          ? json({ status: false, remarks: 'Order id already exists' }, 400)
          : json({ status: 'SUCCESS', shipment: [{ shipmentId: 'ship-2' }] })
      },
      '/rapidshyp/apis/v1/assign_awb': () => json({ awb: 'BD-4' }),
      '/rapidshyp/apis/v1/schedule_pickup': () => json({ status: 'SUCCESS' }),
      '/rapidshyp/apis/v1/generate_label': () => json({ status: true, labelData: [] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({ ...sampleShipment, orderNumber: 2471, serviceId: 'BD' })
    expect([sentOrderId(f, 0), sentOrderId(f, 1)]).toEqual(['2471', '2471-2'])
    // No order_id echoed: cancel and tracking use the id that was sent.
    expect(r.providerRef).toBe('2471-2')
  })

  it('pushes a pending order under the order number', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () =>
        json({ status: 'SUCCESS', shipment: [{ shipment_id: 'ship-5' }] }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const r = await p.pushOrder({ ...sampleShipment, orderNumber: 2471 })
    expect(sentOrderId(f)).toBe('2471')
    expect(r).toEqual({ externalOrderId: '2471', externalShipmentId: 'ship-5' })
  })
})

describe('RapidShyp refusal messages', () => {
  it('explains "Invalid store name" and keeps RapidShyp’s words in brackets', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/create_order': () =>
        json({ status: false, remarks: 'Invalid store name' }, 400),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const err = await p
      .createShipment({ ...sampleShipment, serviceId: 'BD' })
      .catch((e: unknown) => e)
    expect(err).toMatchObject({ kind: 'rejected', reason: 'Invalid store name' })
    expect((err as CourierError).message).toBe(
      "RapidShyp didn't accept the Store name in Apps → RapidShyp → Connect. It is usually DEFAULT. (Invalid store name)",
    )
    expect(describeCourierFailureForStaff(err)).toBe((err as CourierError).message)
  })

  it('explains a remark sent in a 200 answer too', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/wrapper': () =>
        json({ status: 'FAILED', orderCreated: false, remarks: 'Invalid store name' }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({
      message: expect.stringMatching(
        /^RapidShyp didn't accept the Store name.*\(Invalid store name\)$/,
      ),
    })
  })

  it('maps known remarks and leaves unknown ones alone', () => {
    expect(explainRapidshypRemark('Invalid Store Name')).toContain('Store name')
    expect(explainRapidshypRemark('Invalid pickup address name')).toContain('pickup location')
    expect(explainRapidshypRemark('Order id already exists')).toContain('order number')
    expect(explainRapidshypRemark('Insufficient wallet balance')).toContain('Recharge')
    expect(explainRapidshypRemark('Pincode not serviceable')).toContain('Pick another courier')
    expect(explainRapidshypRemark('Something new')).toBeNull()
    expect(explainRapidshypRemark('')).toBeNull()
    expect(rapidshypRefusal('RapidShyp rejected the order', 'Something new')).toBe(
      'RapidShyp rejected the order: Something new',
    )
    expect(rapidshypRefusal('RapidShyp rejected the order', undefined)).toBe(
      'RapidShyp rejected the order: no detail returned',
    )
  })

  it('keeps an unknown 4xx refusal as it was', async () => {
    const f = fakeFetch({
      '/rapidshyp/apis/v1/cancel_order': () => json({ status: false, remarks: 'odd thing' }, 400),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('2471')).rejects.toMatchObject({
      kind: 'unavailable',
      reason: 'odd thing',
    })
  })
})

describe('courierOrderRef', () => {
  it('is the order number for the first booking, suffixed after', () => {
    expect(courierOrderRef({ orderNumber: 2471 })).toBe('2471')
    expect(courierOrderRef({ orderNumber: 2471, shipmentNumber: 1 })).toBe('2471')
    expect(courierOrderRef({ orderNumber: 2471, shipmentNumber: 2 })).toBe('2471-2')
    expect(courierOrderRef({ orderNumber: 2471, shipmentNumber: 2 }, 1)).toBe('2471-3')
    expect(courierOrderRef({ orderNumber: 2471, shipmentNumber: 0 })).toBe('2471')
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

  it('never reads an undelivered attempt as delivered', () => {
    expect(mapRapidshypStatus(undefined, 'UNDELIVERED')).toBe('in_transit')
    expect(mapRapidshypStatus(undefined, 'NOT DELIVERED')).toBe('in_transit')
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

  it('reads scan times as India time, in either date order, and never fails on an odd one', async () => {
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
                  current_tracking_status_code: 'INT',
                  track_scans: [
                    { status_code: 'PUC', date: '18-09-2026 10:00:00' },
                    { status_code: 'INT', date: '2026-09-19 08:00:00' },
                    { status_code: 'INT', date: 'sometime soon' },
                  ],
                },
              ],
            },
          ],
        }),
    })
    const p = new RapidshypProvider({ ...config, fetchImpl: f.impl })
    const t = await p.track('RS999')
    const times = t.events.map((e) => e.at)
    expect(times).toContain('2026-09-18T04:30:00.000Z')
    expect(times).toContain('2026-09-19T02:30:00.000Z')
    expect(t.events).toHaveLength(3)
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

describe('rapidshypFactory base URL', () => {
  it('only accepts the courier own https hosts, since the stored token is sent there', () => {
    expect(
      rapidshypFactory.validateConfig({ ...config, baseUrl: 'https://api.rapidshyp.com' }),
    ).toMatchObject({ ok: true })
    expect(
      rapidshypFactory.validateConfig({ ...config, baseUrl: 'https://attacker.example' }),
    ).toMatchObject({
      ok: false,
    })
    expect(
      rapidshypFactory.validateConfig({ ...config, baseUrl: 'https://10.0.0.5' }),
    ).toMatchObject({
      ok: false,
    })
  })
})

describe('eddDaysFromToday', () => {
  const now = Date.parse('2026-11-10T05:00:00Z') // 10:30 in India

  it('reads RapidShyp’s documented DD-MM-YYYY dates', () => {
    expect(eddDaysFromToday('13-11-2026', now)).toBe(3)
    expect(eddDaysFromToday('16-11-2026', now)).toBe(6)
  })

  it('still reads YYYY-MM-DD and a date with a time after it', () => {
    expect(eddDaysFromToday('2026-11-13', now)).toBe(3)
    expect(eddDaysFromToday('2026-11-13 18:00:00', now)).toBe(3)
    expect(eddDaysFromToday('13/11/2026', now)).toBe(3)
  })

  it('gives nothing for a past, empty or unreadable date', () => {
    expect(eddDaysFromToday('09-11-2026', now)).toBeNull()
    expect(eddDaysFromToday('', now)).toBeNull()
    expect(eddDaysFromToday(undefined, now)).toBeNull()
    expect(eddDaysFromToday('soon', now)).toBeNull()
    expect(eddDaysFromToday('31-02-2026', now)).toBeNull()
  })
})
