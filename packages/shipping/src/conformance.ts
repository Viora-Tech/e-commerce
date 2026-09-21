import { describe, expect, it } from 'vitest'
import { CourierError } from './courier-error'
import type { CreateShipmentInput, ShippingProvider } from './types'

export type ConformanceOptions = {
  /** Fresh provider per test. */
  create: () => ShippingProvider | Promise<ShippingProvider>
  /** A pincode the courier certainly serves (Connaught Place by default). */
  servedPincode?: string | undefined
  originPincode?: string | undefined
  /** Runs live network calls; skip in CI without sandbox keys. */
  live?: boolean
}

export const sampleShipment: CreateShipmentInput = {
  orderId: 'conformance-order',
  orderNumber: 1,
  to: {
    name: 'Asha Verma',
    line1: '12 MG Road',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    country: 'IN',
    phone: '9999999999',
  },
  from: {
    name: 'Waimers',
    line1: 'Plot 4, HSIIDC',
    city: 'Sonipat',
    state: 'HR',
    pincode: '131028',
    country: 'IN',
    phone: '9999999998',
  },
  lines: [{ title: 'Maboroshi mousepad', quantity: 1, unitPricePaise: 199900 }],
  paymentMode: 'prepaid',
  codAmountPaise: 0,
  valuePaise: 199900,
  weightGrams: 500,
}

/**
 * Behavioural contract every ShippingProvider must satisfy. Offline checks
 * always run; live checks only when `live` is true and sandbox credentials exist.
 */
export function describeShippingProvider(name: string, opts: ConformanceOptions): void {
  const served = opts.servedPincode ?? '110001'
  const origin = opts.originPincode ?? '131028'

  describe(`ShippingProvider conformance: ${name}`, () => {
    it('has a stable lowercase id and a label', async () => {
      const a = await opts.create()
      const b = await opts.create()
      expect(a.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(a.id).toBe(b.id)
      expect(a.label.length).toBeGreaterThan(0)
    })

    it('answers verifyCredentials with an actionable message instead of throwing', async () => {
      const p = await opts.create()
      const r = await p.verifyCredentials()
      expect(typeof r.ok).toBe('boolean')
      expect(r.message.length).toBeGreaterThan(0)
    })

    if (opts.live) {
      it('reports a served pincode as serviceable with a transit time or null', async () => {
        const p = await opts.create()
        const r = await p.checkServiceability({
          originPincode: origin,
          destinationPincode: served,
        })
        expect(r.provider).toBe(p.id)
        expect(r.serviceable).toBe(true)
        if (r.minTransitDays !== null) expect(r.minTransitDays).toBeGreaterThanOrEqual(1)
      })

      it('creates, tracks and cancels a shipment', async () => {
        const p = await opts.create()
        const created = await p.createShipment(sampleShipment)
        expect(created.waybill).toBeTruthy()
        const t = await p.track(created.waybill)
        expect(t.waybill).toBe(created.waybill)
        await expect(p.cancel(created.waybill)).resolves.toBeUndefined()
      })
    } else {
      it('turns a network failure into a CourierError, never a raw fetch error', async () => {
        const p = await opts.create()
        // Providers without network (fake) simply resolve; those with network must map errors.
        await p
          .checkServiceability({ originPincode: origin, destinationPincode: served })
          .then(
            (r) => expect(typeof r.serviceable).toBe('boolean'),
            (e) => expect(e).toBeInstanceOf(CourierError),
          )
      })
    }
  })
}
