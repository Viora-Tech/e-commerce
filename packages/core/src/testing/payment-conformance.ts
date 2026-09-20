import { describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import type { PaymentProvider } from '../providers/payment'

export type PaymentConformanceOptions = {
  /** Fresh provider per test. */
  create: () => PaymentProvider | Promise<PaymentProvider>
  /** Context to pass; adapters that hit a real gateway may need a real store. */
  ctx?: StoreContext
  /** Amount to use, in paise. Sandboxes often require a minimum. */
  amountPaise?: number
}

const nullCtx = { storeId: 'conformance', tx: null } as unknown as StoreContext

/**
 * Behavioural contract every PaymentProvider must satisfy. Run it from the
 * adapter's own test file:
 *
 *   describePaymentProvider('razorpay', { create: () => new RazorpayProvider(testKeys) })
 */
export function describePaymentProvider(name: string, opts: PaymentConformanceOptions): void {
  const ctx = opts.ctx ?? nullCtx
  const amountPaise = opts.amountPaise ?? 10000

  describe(`PaymentProvider conformance: ${name}`, () => {
    it('has a stable non-empty id', async () => {
      const a = await opts.create()
      const b = await opts.create()
      expect(a.id).toBeTruthy()
      expect(a.id).toBe(b.id)
    })

    it('creates a payment with a non-empty reference and a known status', async () => {
      const p = await opts.create()
      const r = await p.createPayment(ctx, { orderId: 'order-1', amountPaise, customer: {} })
      expect(r.providerRef).toBeTruthy()
      expect(['pending', 'captured']).toContain(r.status)
    })

    it('issues distinct references for distinct payments', async () => {
      const p = await opts.create()
      const a = await p.createPayment(ctx, { orderId: 'order-1', amountPaise, customer: {} })
      const b = await p.createPayment(ctx, { orderId: 'order-2', amountPaise, customer: {} })
      expect(a.providerRef).not.toBe(b.providerRef)
    })

    it('can capture a pending payment, and capture is idempotent on a captured one', async () => {
      const p = await opts.create()
      const r = await p.createPayment(ctx, { orderId: 'order-1', amountPaise, customer: {} })
      expect(await p.capture(ctx, r.providerRef)).toEqual({ status: 'captured' })
      expect(await p.capture(ctx, r.providerRef)).toEqual({ status: 'captured' })
    })

    it('refunds a captured payment in full', async () => {
      const p = await opts.create()
      const r = await p.createPayment(ctx, { orderId: 'order-1', amountPaise, customer: {} })
      await p.capture(ctx, r.providerRef)
      expect(await p.refund(ctx, r.providerRef, amountPaise)).toEqual({ status: 'refunded' })
    })
  })
}
