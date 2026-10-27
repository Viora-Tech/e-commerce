import {
  CommerceError,
  cancelOrderByStaff,
  type EditOrderOptions,
  editOrder,
  type OrderEdit,
  OrderNotTakeable,
  type PaymentProvider,
  parsePaymentSettings,
  previewOrderEdit,
  refundOptions,
  resolvePaymentProviders,
  type StaffCancelInput,
  takeOverImportedOrder,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import type { PaymentRegistry } from '@commerce/payments'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'

/** The store's connected gateways, the ones a refund to the original payment can go through. */
async function storeProviders(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  secret: string,
): Promise<PaymentProvider[]> {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  return resolvePaymentProviders(registry, parsePaymentSettings(s?.payments), secret).providers
}

/** A refusal the merchant can act on becomes a 400 with its words; anything else is a bug. */
function asRpcError(err: unknown): never {
  if (err instanceof OrderNotTakeable && err.reason === 'not_found') {
    throw new ORPCError('NOT_FOUND', { message: 'Order not found' })
  }
  // OrderEditRefused, OrderNotCancellable, RefundNotAllowed, OutOfStock and the rest.
  if (err instanceof CommerceError) {
    throw new ORPCError('BAD_REQUEST', { message: err.message, data: { code: err.code } })
  }
  throw err
}

export type PaymentsDeps = { registry: PaymentRegistry; secret: string }

/** What "Refund" can offer on this order: how much, and whether to the original payment. */
export async function orderRefundOptions(
  tx: StoreTx,
  storeId: string,
  deps: PaymentsDeps,
  orderId: string,
) {
  const providers = await storeProviders(tx, storeId, deps.registry, deps.secret)
  return refundOptions({ tx, storeId }, orderId, providers)
}

export async function cancelStoreOrder(
  tx: StoreTx,
  storeId: string,
  deps: PaymentsDeps,
  input: StaffCancelInput,
) {
  const providers = await storeProviders(tx, storeId, deps.registry, deps.secret)
  return cancelOrderByStaff({ tx, storeId }, input, providers).catch(asRpcError)
}

export async function takeOverStoreOrder(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  author: string,
) {
  return takeOverImportedOrder({ tx, storeId }, orderId, author).catch(asRpcError)
}

export async function previewStoreOrderEdit(
  tx: StoreTx,
  storeId: string,
  deps: PaymentsDeps,
  edit: OrderEdit,
) {
  const providers = await storeProviders(tx, storeId, deps.registry, deps.secret)
  return previewOrderEdit({ tx, storeId }, edit, providers).catch(asRpcError)
}

export async function editStoreOrder(
  tx: StoreTx,
  storeId: string,
  deps: PaymentsDeps,
  edit: OrderEdit,
  opts: EditOrderOptions,
) {
  const providers = await storeProviders(tx, storeId, deps.registry, deps.secret)
  const r = await editOrder({ tx, storeId }, edit, opts, providers).catch(asRpcError)
  return { order: r.order, settlement: r.settlement, totalPaise: r.plan.after.totalPaise }
}
