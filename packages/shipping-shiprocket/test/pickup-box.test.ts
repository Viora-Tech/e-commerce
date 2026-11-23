import { sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { ShiprocketProvider, shiprocketFactory } from '../src/shiprocket'

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

const booking = (pickup: Route) => ({
  '/auth/login': () => json({ token: 'tok' }),
  '/orders/create/adhoc': () => json({ order_id: 555, shipment_id: 777 }),
  '/courier/assign/awb': () => json({ response: { data: { awb_code: 'SR9' } } }),
  '/courier/generate/label': () => json({ label_url: 'https://labels/777.pdf' }),
  '/courier/generate/pickup': pickup,
})

describe('Shiprocket asks the pickup at booking', () => {
  it('records the pickup when Shiprocket takes it', async () => {
    const f = fakeFetch(
      booking(() => json({ pickup_status: 1, response: { pickup_scheduled_date: '2026-11-24' } })),
    )
    const r = await new ShiprocketProvider({ ...config, fetchImpl: f.impl }).createShipment(
      sampleShipment,
    )
    expect(r).toMatchObject({ waybill: 'SR9', providerRef: '777', pickupScheduled: true })
    expect(f.calls.find((c) => c.path.endsWith('/generate/pickup'))?.body).toEqual({
      shipment_id: [777],
    })
  })

  it('keeps the booking in Booked (no pickup) when Shiprocket refuses or fails', async () => {
    for (const answer of [
      () => json({ pickup_status: 0, message: 'Already in pickup queue' }),
      () => json({ message: 'boom' }, 500),
    ]) {
      const f = fakeFetch(booking(answer))
      const r = await new ShiprocketProvider({ ...config, fetchImpl: f.impl }).createShipment(
        sampleShipment,
      )
      expect(r.waybill).toBe('SR9')
      expect(r.pickupScheduled).toBeUndefined()
    }
  })

  it('declares pickup at booking and Create pickup', () => {
    expect(shiprocketFactory.capabilities).toEqual(
      expect.arrayContaining(['pickup', 'pickup_at_booking']),
    )
  })
})

describe('Shiprocket Create pickup', () => {
  const input = {
    pickupLocationName: 'Waimers Sonipat',
    date: '2026-11-24',
    timeFrom: '14:00',
    expectedPackageCount: 2,
    parcels: [
      { waybill: 'SR1', providerRef: '701' },
      { waybill: 'SR2', providerRef: '702' },
    ],
  }

  it('asks for the parcels by their Shiprocket shipment ids', async () => {
    const f = fakeFetch({
      '/auth/login': () => json({ token: 'tok' }),
      '/courier/generate/pickup': () =>
        json({ pickup_status: 1, response: { pickup_token_number: 'Ref 123' } }),
    })
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    expect(p.pickupPerParcel).toBe(true)
    expect(await p.schedulePickup(input)).toEqual({ providerPickupId: 'Ref 123' })
    expect(f.calls.find((c) => c.path.endsWith('/generate/pickup'))?.body).toEqual({
      shipment_id: [701, 702],
    })
  })

  it('says in plain words when Shiprocket refuses', async () => {
    const f = fakeFetch({
      '/auth/login': () => json({ token: 'tok' }),
      '/courier/generate/pickup': () =>
        json({ pickup_status: 0, message: 'Pickup cut-off passed' }),
    })
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await expect(p.schedulePickup(input)).rejects.toMatchObject({
      kind: 'rejected',
      message: 'Shiprocket did not take the pickup: Pickup cut-off passed',
    })
  })
})

describe('Shiprocket box size', () => {
  it('sends the parcel’s box, and the 10 cm cube when it has none', async () => {
    const f = fakeFetch(booking(() => json({ pickup_status: 1 })))
    const p = new ShiprocketProvider({ ...config, fetchImpl: f.impl })
    await p.createShipment({
      ...sampleShipment,
      dimensionsCm: { length: 37, width: 14, height: 4.5 },
    })
    await p.createShipment(sampleShipment)
    const sent = f.calls
      .filter((c) => c.path.endsWith('/orders/create/adhoc'))
      .map((c) => c.body as Record<string, number>)
      .map((b) => [b.length, b.breadth, b.height])
    expect(sent).toEqual([
      [37, 14, 4.5],
      [10, 10, 10],
    ])
  })
})
