import { describe, expect, it } from 'vitest'
import type { PaymentProvider } from './types'

export type ConformanceOptions = {
  /** Fresh provider per test. */
  create: () => PaymentProvider | Promise<PaymentProvider>
  /** Amount to use in paise. Sandboxes often enforce a minimum (Razorpay: ₹1). */
  amountPaise?: number
  /**
   * A valid signed webhook the adapter must accept, and a tampered one it must
   * reject. Adapters can build these from their sandbox secret.
   */
  webhooks?: {
    valid: { rawBody: string; headers: Record<string, string> }
    tampered: { rawBody: string; headers: Record<string, string> }
  }
  /** Runs live network calls; skip in CI without sandbox keys. */
  live?: boolean
}

/**
 * Behavioural contract every PaymentProvider must satisfy. Run it from the
 * adapter's own test file. Offline checks always run; live checks only when
 * `live` is true and the adapter has sandbox credentials.
 */
export function describePaymentProvider(name: string, opts: ConformanceOptions): void {
  const amountPaise = opts.amountPaise ?? 10000

  describe(`PaymentProvider conformance: ${name}`, () => {
    it('has a stable lowercase id and a label', async () => {
      const a = await opts.create()
      const b = await opts.create()
      expect(a.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(a.id).toBe(b.id)
      expect(a.label.length).toBeGreaterThan(0)
    })

    it('rejects a webhook with a bad signature without throwing', async () => {
      const p = await opts.create()
      const r = p.parseWebhook({ rawBody: '{"event":"payment.captured"}', headers: {} })
      expect(r.ok).toBe(false)
    })

    if (opts.webhooks) {
      const { valid, tampered } = opts.webhooks
      it('accepts a correctly signed webhook and normalises it', async () => {
        const p = await opts.create()
        const r = p.parseWebhook(valid)
        expect(r.ok).toBe(true)
        if (r.ok) {
          expect(r.eventId).toBeTruthy()
          expect(r.event.type).toBeTruthy()
        }
      })

      it('rejects a tampered body', async () => {
        const p = await opts.create()
        expect(p.parseWebhook(tampered).ok).toBe(false)
      })
    }

    if (opts.live) {
      it('creates a payment with a reference and a checkout session', async () => {
        const p = await opts.create()
        const r = await p.createPayment({
          orderId: 'conformance-order',
          orderNumber: 1,
          amountPaise,
          currency: 'INR',
          customer: { email: 'test@example.com', phone: '9999999999' },
        })
        expect(r.providerRef).toBeTruthy()
        expect(['pending', 'captured']).toContain(r.status)
        expect(r.session.providerRef).toBe(r.providerRef)
        expect(['client', 'redirect', 'manual', 'none']).toContain(r.session.kind)
      })

      it('reports status for a fresh payment as pending', async () => {
        const p = await opts.create()
        const r = await p.createPayment({
          orderId: 'conformance-order-2',
          amountPaise,
          currency: 'INR',
          customer: {},
        })
        const s = await p.fetchStatus(r.providerRef)
        expect(s.amountPaise).toBe(amountPaise)
        expect(s.status).toBe('pending')
      })
    }
  })
}
