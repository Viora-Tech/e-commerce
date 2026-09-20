import type { StoreContext } from '../context'
import type { PaymentProvider } from './payment'

/**
 * Cash on delivery. Nothing is charged at checkout, so the order stays
 * `placed` with a `pending` payment until the courier remits.
 */
export class CodPaymentProvider implements PaymentProvider {
  readonly id = 'cod'

  async createPayment(_ctx: StoreContext, input: { orderId: string }) {
    return { providerRef: `cod_${input.orderId}`, status: 'pending' as const }
  }

  async capture(_ctx: StoreContext) {
    return { status: 'captured' as const }
  }

  async refund(_ctx: StoreContext) {
    return { status: 'refunded' as const }
  }
}
