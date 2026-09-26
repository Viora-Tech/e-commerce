import {
  approveReturn,
  arrangeReturnPickup,
  CommerceError,
  closeReturn,
  deliverGiftCard,
  exchangeReturn,
  getReturn,
  giftCardChannels,
  listReturns,
  loadReturnPolicy,
  orderReturnState,
  parseShippingSettings,
  type ReceiveReturnInput,
  type RequestReturnInput,
  type ReturnListFilter,
  receiveReturn,
  refundablePayments,
  refundReturn,
  rejectReturn,
  requestReturn,
  reshipReturn,
  resolveShippingProviders,
  restockReturn,
  returnCounts,
  rtoSummary,
  saveReturnPolicy,
  setReturnCourierCost,
  storeCreditReturn,
  suggestedRefundPaise,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { giftCard, shipment, store } from '@commerce/db'
import type { NotificationRegistry } from '@commerce/notifications'
import type { PaymentRegistry } from '@commerce/payments'
import { CourierError, describeCourierFailure, type ShippingRegistry } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { providerForPayment } from './order.service'

/** Business-rule refusals become BAD_REQUEST with our own words; courier failures too. */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof CourierError) {
      const detail = err.kind === 'rejected' ? err.message : describeCourierFailure(err)
      throw new ORPCError('BAD_REQUEST', { message: detail })
    }
    if (err instanceof CommerceError) throw new ORPCError('BAD_REQUEST', { message: err.message })
    throw err
  }
}

async function shippingProviders(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
) {
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  return resolveShippingProviders(registry, parseShippingSettings(s?.shipping), secret).providers
}

/** Connected couriers that can collect a return from the shopper. */
async function pickupCouriers(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
) {
  const providers = await shippingProviders(tx, storeId, registry, secret)
  return providers
    .filter(
      (p) =>
        registry.get(p.id)?.capabilities.includes('reverse_pickup') &&
        typeof p.createReturnPickup === 'function',
    )
    .map((p) => ({ id: p.id, label: p.label }))
}

export const listStoreReturns = (tx: StoreTx, storeId: string, filter: ReturnListFilter) =>
  listReturns({ storeId, tx }, filter)

export const storeReturnCounts = (tx: StoreTx, storeId: string) => returnCounts({ storeId, tx })

export const storeReturnPolicy = (tx: StoreTx, storeId: string) => loadReturnPolicy({ storeId, tx })

export const updateStoreReturnPolicy = (tx: StoreTx, storeId: string, input: unknown) =>
  saveReturnPolicy({ storeId, tx }, input)

export const orderReturns = (tx: StoreTx, storeId: string, orderId: string) =>
  orderReturnState({ storeId, tx }, orderId)

export const storeRtoSummary = (tx: StoreTx, storeId: string, sinceDays: number) =>
  rtoSummary({ storeId, tx }, sinceDays)

/** The detail page: the return, what can be refunded, and which couriers can collect it. */
export async function returnDetail(
  tx: StoreTx,
  storeId: string,
  shippingRegistry: ShippingRegistry,
  secret: string,
  id: string,
) {
  const ctx = { storeId, tx }
  const r = await getReturn(ctx, id)
  if (!r) return null
  const [payments, couriers, policy] = await Promise.all([
    refundablePayments(ctx, r.orderId),
    pickupCouriers(tx, storeId, shippingRegistry, secret),
    loadReturnPolicy(ctx),
  ])
  const suggestion = r.status === 'received' ? await suggestedRefundPaise(ctx, id) : null
  const [card] = r.giftCardId
    ? await tx
        .select({ id: giftCard.id, lastCharacters: giftCard.lastCharacters })
        .from(giftCard)
        .where(eq(giftCard.id, r.giftCardId))
    : []
  const [rtoShipment] = r.shipmentId
    ? await tx
        .select({ waybill: shipment.waybill, provider: shipment.provider })
        .from(shipment)
        .where(eq(shipment.id, r.shipmentId))
    : []
  return {
    ...r,
    refundable: payments,
    refundablePaise: payments.reduce((s, p) => s + p.availablePaise, 0),
    suggestedRefundPaise: suggestion,
    pickupCouriers: couriers,
    policy,
    giftCard: card ?? null,
    rtoShipment: rtoShipment ?? null,
  }
}

/** The merchant opens a return for the shopper (a phone call, a WhatsApp message). */
export const createStoreReturn = (
  tx: StoreTx,
  storeId: string,
  input: Omit<RequestReturnInput, 'requestedBy' | 'customerId'>,
) => run(() => requestReturn({ storeId, tx }, { ...input, requestedBy: 'merchant' }))

export type PickupChoice =
  | { method: 'courier'; providerId: string }
  | { method: 'customer' }
  | { method: 'later' }

async function arrange(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  id: string,
  pickup: PickupChoice,
) {
  if (pickup.method === 'later') return null
  if (pickup.method === 'customer') return arrangeReturnPickup({ storeId, tx }, id, null)
  const provider = (await shippingProviders(tx, storeId, registry, secret)).find(
    (p) => p.id === pickup.providerId,
  )
  if (!provider) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'That courier is not connected.' })
  }
  return arrangeReturnPickup({ storeId, tx }, id, provider)
}

/** Approve, and in the same step say how the parcel comes back (so the email can say it too). */
export const approveStoreReturn = (
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  id: string,
  pickup: PickupChoice,
) =>
  run(async () => {
    await approveReturn({ storeId, tx }, id)
    await arrange(tx, storeId, registry, secret, id, pickup)
    return getReturn({ storeId, tx }, id)
  })

export const arrangeStoreReturnPickup = (
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  id: string,
  pickup: PickupChoice,
) => run(() => arrange(tx, storeId, registry, secret, id, pickup))

export const rejectStoreReturn = (tx: StoreTx, storeId: string, id: string, note: string) =>
  run(() => rejectReturn({ storeId, tx }, id, note))

export const receiveStoreReturn = (
  tx: StoreTx,
  storeId: string,
  id: string,
  input: ReceiveReturnInput,
) => run(() => receiveReturn({ storeId, tx }, id, input))

export const restockStoreReturn = (tx: StoreTx, storeId: string, id: string) =>
  run(() => restockReturn({ storeId, tx }, id))

export const closeStoreReturn = (tx: StoreTx, storeId: string, id: string) =>
  run(() => closeReturn({ storeId, tx }, id))

export const setStoreReturnCourierCost = (
  tx: StoreTx,
  storeId: string,
  id: string,
  paise: number | null,
) => run(() => setReturnCourierCost({ storeId, tx }, id, paise))

/** Refund to the original payment, through each gateway's own refund call. */
export const refundStoreReturn = (
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  secret: string,
  id: string,
  amountPaise: number,
) =>
  run(() =>
    refundReturn({ storeId, tx }, id, {
      amountPaise,
      providerFor: (providerId) => providerForPayment(tx, storeId, registry, secret, providerId),
    }),
  )

/** Store credit as a gift card, emailed to the shopper straight away. */
export const storeCreditStoreReturn = (
  tx: StoreTx,
  storeId: string,
  registry: NotificationRegistry,
  secret: string,
  id: string,
  amountPaise: number,
  createdBy: string,
) =>
  run(async () => {
    const ctx = { storeId, tx }
    const r = await storeCreditReturn(ctx, id, { amountPaise, secret, createdBy })
    const channels = await giftCardChannels(ctx, registry, secret)
    const delivery = await deliverGiftCard(ctx, r.giftCardId, { channels, secret })
    return { ...r, delivery }
  })

export const exchangeStoreReturn = (
  tx: StoreTx,
  storeId: string,
  id: string,
  lines?: { variantId: string; quantity: number }[],
) => run(() => exchangeReturn({ storeId, tx }, id, { lines }))

/** Send an RTO parcel out again with the courier that carried it (or the store's first courier). */
export const reshipStoreReturn = (
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  id: string,
) =>
  run(async () => {
    const ctx = { storeId, tx }
    const r = await getReturn(ctx, id)
    if (!r) throw new ORPCError('NOT_FOUND')
    const providers = await shippingProviders(tx, storeId, registry, secret)
    const [was] = r.shipmentId
      ? await tx
          .select({ provider: shipment.provider })
          .from(shipment)
          .where(eq(shipment.id, r.shipmentId))
      : []
    const provider = providers.find((p) => p.id === was?.provider) ?? providers[0]
    if (!provider) {
      throw new ORPCError('PRECONDITION_FAILED', {
        message: 'Connect a courier in Apps first, then try again.',
      })
    }
    return reshipReturn(ctx, id, provider)
  })
