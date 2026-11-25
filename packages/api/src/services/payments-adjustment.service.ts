/** A payment app's own "Extra charge" card (Snapmint, Razorpay, Cashfree): its one entry in `store.payments.adjustments`. */
import type { PaymentAdjustment, PaymentRegistry } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { type PaymentsEnv, writeSettings } from './payments-setup.service'

/**
 * Save or remove the fee (or discount) for paying with one provider. Only that provider's key in
 * `adjustments` changes; every other payment setting and adjustment is kept as saved.
 */
export function savePaymentAdjustment(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  env: Pick<PaymentsEnv, 'secret' | 'previousSecrets'>,
  providerId: string,
  adjustment: PaymentAdjustment | null,
) {
  return writeSettings(tx, storeId, registry, env, (s) => {
    const { [providerId]: _old, ...rest } = s.adjustments
    return { ...s, adjustments: adjustment ? { ...rest, [providerId]: adjustment } : rest }
  })
}
