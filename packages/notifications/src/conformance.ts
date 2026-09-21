import { describe, expect, it } from 'vitest'
import type { NotificationChannel, TemplateData } from './types'

export type ConformanceOptions = {
  /** Fresh channel per test. */
  create: () => NotificationChannel | Promise<NotificationChannel>
  /** Recipient a live test may actually message. Skipped without `live`. */
  recipient?: { email?: string; phone?: string } | undefined
  /** Runs real sends; only when sandbox credentials are present. */
  live?: boolean
}

export const sampleTemplateData: TemplateData = {
  storeName: 'Waimers',
  orderNumber: 42,
  customerName: 'Asha',
  totalLabel: '₹2,048',
  lines: [{ title: 'Maboroshi mousepad', quantity: 1, priceLabel: '₹1,999' }],
  paymentMethodLabel: 'Cash on delivery',
}

/** Behavioural contract every NotificationChannel must satisfy. Offline checks always run. */
export function describeNotificationChannel(name: string, opts: ConformanceOptions): void {
  describe(`NotificationChannel conformance: ${name}`, () => {
    it('has a stable lowercase id, a label and a recipient requirement', async () => {
      const a = await opts.create()
      const b = await opts.create()
      expect(a.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(a.id).toBe(b.id)
      expect(a.label.length).toBeGreaterThan(0)
      expect(['email', 'phone']).toContain(a.requires)
    })

    it('reports a missing recipient as a failure instead of throwing', async () => {
      const c = await opts.create()
      const r = await c.send({ to: {}, template: 'order_placed', data: sampleTemplateData })
      expect(r.ok).toBe(false)
    })

    if (opts.live && opts.recipient) {
      const to = opts.recipient
      it('delivers a real order_placed message', async () => {
        const c = await opts.create()
        const r = await c.send({ to, template: 'order_placed', data: sampleTemplateData })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.providerRef).toBeTruthy()
      })
    }
  })
}
