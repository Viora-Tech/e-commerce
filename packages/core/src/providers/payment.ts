import type { StoreContext } from '../context'

export type PaymentStatus = 'pending' | 'captured'

export interface PaymentProvider {
  readonly id: string
  createPayment(
    ctx: StoreContext,
    input: {
      orderId: string
      amountPaise: number
      customer: { email?: string | undefined; phone?: string | undefined }
    },
  ): Promise<{ providerRef: string; status: PaymentStatus }>
  capture(ctx: StoreContext, providerRef: string): Promise<{ status: 'captured' }>
  refund(
    ctx: StoreContext,
    providerRef: string,
    amountPaise: number,
  ): Promise<{ status: 'refunded' }>
}

/** Test double. `capture` mode succeeds immediately; `fail` mode throws on createPayment. */
export class FakePaymentProvider implements PaymentProvider {
  readonly id = 'fake'
  readonly calls: string[] = []
  private counter = 0

  constructor(private readonly opts: { mode: 'capture' | 'fail' } = { mode: 'capture' }) {}

  async createPayment(
    _ctx: StoreContext,
    input: {
      orderId: string
      amountPaise: number
      customer: { email?: string | undefined; phone?: string | undefined }
    },
  ) {
    this.calls.push(`createPayment:${input.orderId}:${input.amountPaise}`)
    if (this.opts.mode === 'fail') throw new Error('fake gateway declined')
    this.counter += 1
    return { providerRef: `fake_${this.counter}`, status: 'captured' as const }
  }

  async capture(_ctx: StoreContext, providerRef: string) {
    this.calls.push(`capture:${providerRef}`)
    return { status: 'captured' as const }
  }

  async refund(_ctx: StoreContext, providerRef: string, amountPaise: number) {
    this.calls.push(`refund:${providerRef}:${amountPaise}`)
    return { status: 'refunded' as const }
  }
}
