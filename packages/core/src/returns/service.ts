/** SOURCE OF TRUTH: return requests — WHAT: ask for a return, approve, reject, arrange the pickup, receive, restock, and the lists and details the storefront and admin read / WHY: one place owns every state change of `return_request`, writes its outbox event in the same transaction and keeps the order's statuses in step */
import {
  address,
  customer,
  inventoryLevel,
  media,
  order,
  orderLine,
  primarySellingLevel,
  productMedia,
  returnRequest,
  returnRequestLine,
  shipment,
  store,
  variant,
} from '@commerce/db'
import { ASSUMED_WEIGHT_GRAMS, type ShippingProvider, type Tracking } from '@commerce/shipping'
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { adjustStock } from '../inventory/levels'
import { lineLocation } from '../order/fulfillment-orders'
import { recomputeOrderStatuses } from '../order/recompute'
import { insertOutboxEvent } from '../outbox/write'
import { resolveParcelWeightGrams } from '../shipping/parcel'
import { defaultBoxPreset, parseShippingSettings } from '../shipping/settings'
import { shipFromFor } from '../shipping/ship-from'
import {
  ACTIVE_RETURN_STATUSES,
  type Eligibility,
  parseReturnPolicy,
  RETURN_REASONS,
  type ReturnPolicy,
  ReturnPolicySchema,
  type ReturnReason,
  type ReturnStatus,
  returnEligibility,
  returnLabel,
} from './policy'
import { applyReturnWishes, type ReturnWishes } from './preferences'

export type ReturnRow = typeof returnRequest.$inferSelect

export class ReturnNotAllowed extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('RETURN_NOT_ALLOWED', message, { storeId })
  }
}

/** What a shopper sees when a request is refused, by eligibility reason. */
const CLOSED_MESSAGES: Record<Exclude<Eligibility['why'], 'ok'>, string> = {
  disabled: 'This shop does not take returns online. Please contact the shop.',
  cancelled: 'This order was cancelled, so there is nothing to return.',
  not_delivered: 'You can ask for a return once the order has been delivered.',
  window_closed: 'The time to return this order has passed.',
  nothing_left: 'Every item on this order is already being returned.',
}

export async function loadReturnPolicy(ctx: StoreContext): Promise<ReturnPolicy> {
  const [s] = await ctx.tx
    .select({ returns: store.returns })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parseReturnPolicy(s?.returns)
}

export async function saveReturnPolicy(ctx: StoreContext, input: unknown): Promise<ReturnPolicy> {
  const policy = ReturnPolicySchema.parse(input)
  await ctx.tx.update(store).set({ returns: policy }).where(eq(store.id, ctx.storeId))
  return policy
}

/**
 * When the parcel reached the shopper: the merchant's "mark as delivered", or
 * the courier's delivered scan (its event time, else when we recorded it).
 */
async function deliveredAtFor(
  ctx: StoreContext,
  o: { id: string; deliveredAt: Date | null },
): Promise<Date | null> {
  if (o.deliveredAt) return o.deliveredAt
  const rows = await ctx.tx
    .select({ tracking: shipment.tracking, updatedAt: shipment.updatedAt })
    .from(shipment)
    .where(and(eq(shipment.orderId, o.id), eq(shipment.status, 'delivered')))
    .orderBy(desc(shipment.updatedAt))
  const row = rows[0]
  if (!row) return null
  const events = (row.tracking as Tracking | null)?.events ?? []
  const scan = [...events].reverse().find((e) => e.status === 'delivered')
  const at = scan ? new Date(scan.at) : null
  return at && !Number.isNaN(at.getTime()) && at.getTime() > 0 ? at : row.updatedAt
}

/** Units of each order line already in a live customer return. */
async function alreadyReturning(ctx: StoreContext, orderId: string): Promise<Map<string, number>> {
  const rows = await ctx.tx
    .select({ lineId: returnRequestLine.orderLineId, quantity: returnRequestLine.quantity })
    .from(returnRequestLine)
    .innerJoin(returnRequest, eq(returnRequest.id, returnRequestLine.returnRequestId))
    .where(
      and(
        eq(returnRequest.orderId, orderId),
        eq(returnRequest.kind, 'return'),
        inArray(returnRequest.status, [...ACTIVE_RETURN_STATUSES]),
      ),
    )
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.lineId, (map.get(r.lineId) ?? 0) + r.quantity)
  }
  return map
}

/** The next per-store return number. The advisory lock makes two requests at once queue. */
export async function nextReturnNumber(ctx: StoreContext): Promise<number> {
  await ctx.tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`return_number:${ctx.storeId}`}, 0))`,
  )
  const [row] = await ctx.tx
    .select({ max: sql<number>`coalesce(max(${returnRequest.number}), 0)::int` })
    .from(returnRequest)
    .where(eq(returnRequest.storeId, ctx.storeId))
  return Number(row?.max ?? 0) + 1
}

export type OrderLineView = {
  id: string
  variantId: string
  title: string
  variantTitle: string | null
  quantity: number
  fulfilledQuantity: number
  unitPricePaise: number
  giftCard: boolean
  imageUrl: string | null
}

/** An order's lines with a picture each (the variant's own, else the product's first). */
async function orderLinesWithImages(ctx: StoreContext, orderId: string): Promise<OrderLineView[]> {
  const lines = await ctx.tx
    .select({
      id: orderLine.id,
      variantId: orderLine.variantId,
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      fulfilledQuantity: orderLine.fulfilledQuantity,
      unitPricePaise: orderLine.unitPricePaise,
      giftCard: orderLine.giftCard,
      productId: variant.productId,
      variantImage: media.url,
    })
    .from(orderLine)
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(eq(orderLine.orderId, orderId))
    .orderBy(asc(orderLine.id))
  const productIds = [...new Set(lines.map((l) => l.productId))]
  const images = productIds.length
    ? await ctx.tx
        .select({ productId: productMedia.productId, url: media.url })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(and(inArray(productMedia.productId, productIds), eq(productMedia.position, 0)))
    : []
  return lines.map((l) => ({
    id: l.id,
    variantId: l.variantId,
    title: l.title ?? '',
    variantTitle: l.variantTitle,
    quantity: l.quantity,
    fulfilledQuantity: l.fulfilledQuantity,
    unitPricePaise: l.unitPricePaise,
    giftCard: l.giftCard,
    imageUrl: l.variantImage ?? images.find((i) => i.productId === l.productId)?.url ?? null,
  }))
}

export type ReturnLineView = OrderLineView & {
  returnLineId: string
  returnQuantity: number
  restockedQuantity: number
}

export type ReturnView = ReturnRow & {
  label: string
  lines: ReturnLineView[]
  valuePaise: number
}

/** Returns with their lines, newest first. */
async function returnsWithLines(
  ctx: StoreContext,
  rows: ReturnRow[],
  orderLines: Map<string, OrderLineView[]>,
): Promise<ReturnView[]> {
  if (rows.length === 0) return []
  const lineRows = await ctx.tx
    .select()
    .from(returnRequestLine)
    .where(
      inArray(
        returnRequestLine.returnRequestId,
        rows.map((r) => r.id),
      ),
    )
  return rows.map((r) => {
    const byId = new Map((orderLines.get(r.orderId) ?? []).map((l) => [l.id, l]))
    const lines = lineRows
      .filter((l) => l.returnRequestId === r.id)
      .flatMap((l) => {
        const ol = byId.get(l.orderLineId)
        return ol
          ? [
              {
                ...ol,
                returnLineId: l.id,
                returnQuantity: l.quantity,
                restockedQuantity: l.restockedQuantity,
              },
            ]
          : []
      })
    return {
      ...r,
      label: returnLabel(r.number),
      lines,
      valuePaise: lines.reduce((s, l) => s + l.returnQuantity * l.unitPricePaise, 0),
    }
  })
}

export type OrderReturnState = {
  policy: ReturnPolicy
  deliveredAt: Date | null
  eligibility: Eligibility
  lines: OrderLineView[]
  returns: ReturnView[]
}

/** Everything the order pages need about returns: what can go back, and what already did. */
export async function orderReturnState(
  ctx: StoreContext,
  orderId: string,
  now: Date = new Date(),
): Promise<OrderReturnState | null> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) return null
  const [policy, deliveredAt, lines, returning] = await Promise.all([
    loadReturnPolicy(ctx),
    deliveredAtFor(ctx, o),
    orderLinesWithImages(ctx, orderId),
    alreadyReturning(ctx, orderId),
  ])
  const rows = await ctx.tx
    .select()
    .from(returnRequest)
    .where(eq(returnRequest.orderId, orderId))
    .orderBy(desc(returnRequest.requestedAt))
  return {
    policy,
    deliveredAt,
    eligibility: returnEligibility({
      policy,
      status: o.status,
      deliveredAt,
      lines,
      alreadyReturning: returning,
      now,
    }),
    lines,
    returns: await returnsWithLines(ctx, rows, new Map([[orderId, lines]])),
  }
}

export type RequestReturnInput = ReturnWishes & {
  orderId: string
  lines: { orderLineId: string; quantity: number }[]
  reason: ReturnReason
  note?: string | null | undefined
  photos?: string[] | undefined
  /** `customer`: from the storefront, held to the store's window and reasons. */
  requestedBy: 'customer' | 'merchant'
  /** Set on storefront requests: the order must belong to this customer. */
  customerId?: string | undefined
  now?: Date | undefined
}

const MAX_PHOTOS = 5

/**
 * Open a return. A shopper is held to the store's window and reason list; the
 * merchant (creating one on the shopper's behalf, e.g. after a phone call) is
 * not held to the window, but neither can send back more than was shipped.
 */
export async function requestReturn(ctx: StoreContext, input: RequestReturnInput) {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, input.orderId)).for('update')
  if (!o) throw new ReturnNotAllowed('Order not found', ctx.storeId)
  if (input.customerId && o.customerId !== input.customerId) {
    throw new ReturnNotAllowed('Order not found', ctx.storeId)
  }
  if (o.importedFrom) {
    throw new ReturnNotAllowed('Imported orders are read-only.', ctx.storeId)
  }
  const state = await orderReturnState(ctx, o.id, input.now)
  if (!state) throw new ReturnNotAllowed('Order not found', ctx.storeId)
  const byCustomer = input.requestedBy === 'customer'
  const why = state.eligibility.why
  if (byCustomer && why !== 'ok') throw new ReturnNotAllowed(CLOSED_MESSAGES[why], ctx.storeId)
  if (!byCustomer && (why === 'cancelled' || why === 'nothing_left')) {
    throw new ReturnNotAllowed(CLOSED_MESSAGES[why], ctx.storeId)
  }
  if (!(RETURN_REASONS as readonly string[]).includes(input.reason)) {
    throw new ReturnNotAllowed('Pick a reason for the return.', ctx.storeId)
  }
  if (byCustomer && !state.policy.reasons.includes(input.reason)) {
    throw new ReturnNotAllowed('This shop does not take returns for that reason.', ctx.storeId)
  }

  const wanted = new Map<string, number>()
  for (const l of input.lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) continue
    wanted.set(l.orderLineId, (wanted.get(l.orderLineId) ?? 0) + l.quantity)
  }
  if (wanted.size === 0) throw new ReturnNotAllowed('Choose at least one item.', ctx.storeId)
  const returnable = new Map(state.eligibility.lines.map((l) => [l.lineId, l.returnable]))
  for (const [lineId, qty] of wanted) {
    if (qty > (returnable.get(lineId) ?? 0)) {
      throw new ReturnNotAllowed('You can not return more than was delivered.', ctx.storeId)
    }
  }
  const photos = (input.photos ?? []).filter((u) => /^https?:\/\//.test(u)).slice(0, MAX_PHOTOS)

  const number = await nextReturnNumber(ctx)
  const [row] = await ctx.tx
    .insert(returnRequest)
    .values({
      storeId: ctx.storeId,
      orderId: o.id,
      number,
      kind: 'return',
      status: 'requested',
      reason: input.reason,
      customerNote: input.note?.trim() || null,
      photos,
      restock: state.policy.restockAutomatically,
      requestedBy: input.requestedBy,
    })
    .returning()
  if (!row) throw new CommerceError('RETURN_INSERT_FAILED', 'return insert returned nothing')
  await ctx.tx.insert(returnRequestLine).values(
    [...wanted].map(([orderLineId, quantity]) => ({
      storeId: ctx.storeId,
      returnRequestId: row.id,
      orderLineId,
      quantity,
    })),
  )
  const auto = await applyReturnWishes(ctx, row, { ...input, lines: wanted }, state.policy)
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'return.requested', {
    orderId: o.id,
    returnId: row.id,
  })
  // The store's auto-approve rule took it: approved now, the merchant arranges the pickup.
  return auto ? approveReturn(ctx, row.id) : row
}

/** Lock one return for a state change; refuses a missing one. */
export async function lockReturn(ctx: StoreContext, id: string): Promise<ReturnRow> {
  const [r] = await ctx.tx
    .select()
    .from(returnRequest)
    .where(eq(returnRequest.id, id))
    .for('update')
  if (!r) throw new ReturnNotAllowed('Return not found', ctx.storeId)
  return r
}

async function setReturn(ctx: StoreContext, id: string, patch: Partial<ReturnRow>) {
  const [row] = await ctx.tx
    .update(returnRequest)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(returnRequest.id, id))
    .returning()
  if (!row) throw new ReturnNotAllowed('Return not found', ctx.storeId)
  return row
}

function expect(ctx: StoreContext, r: ReturnRow, allowed: ReturnStatus[], action: string) {
  if (!allowed.includes(r.status)) {
    throw new ReturnNotAllowed(
      `Return ${returnLabel(r.number)} is ${r.status.replace('_', ' ')}, so it can not be ${action}.`,
      ctx.storeId,
    )
  }
}

export async function approveReturn(ctx: StoreContext, id: string) {
  const r = await lockReturn(ctx, id)
  if (r.kind !== 'return') throw new ReturnNotAllowed('RTO parcels need no approval', ctx.storeId)
  expect(ctx, r, ['requested'], 'approved')
  const row = await setReturn(ctx, id, { status: 'approved', approvedAt: new Date() })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'return.approved', {
    orderId: r.orderId,
    returnId: r.id,
  })
  return row
}

export async function rejectReturn(ctx: StoreContext, id: string, note: string) {
  const r = await lockReturn(ctx, id)
  if (r.kind !== 'return') throw new ReturnNotAllowed('An RTO can not be rejected', ctx.storeId)
  expect(ctx, r, ['requested', 'approved'], 'declined')
  const reason = note.trim()
  if (!reason) throw new ReturnNotAllowed('Tell the customer why.', ctx.storeId)
  const row = await setReturn(ctx, id, {
    status: 'rejected',
    rejectedAt: new Date(),
    decisionNote: reason,
  })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'return.rejected', {
    orderId: r.orderId,
    returnId: r.id,
  })
  return row
}

/**
 * How the parcel comes back. With a courier that supports reverse pickups,
 * book one (the waybill is saved on the return); without, the shopper sends
 * it and the merchant marks it received when it arrives.
 */
export async function arrangeReturnPickup(
  ctx: StoreContext,
  id: string,
  provider: ShippingProvider | null,
) {
  const r = await lockReturn(ctx, id)
  expect(ctx, r, ['approved'], 'sent back yet')
  if (!provider) {
    return setReturn(ctx, id, {
      status: 'in_transit',
      pickupMethod: 'customer',
      pickupArrangedAt: new Date(),
    })
  }
  if (!provider.createReturnPickup) {
    throw new ReturnNotAllowed(`${provider.label} can not collect returns.`, ctx.storeId)
  }
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, r.orderId))
  if (!o?.shippingAddressId) {
    throw new ReturnNotAllowed('This order has no address to collect from.', ctx.storeId)
  }
  const [from] = await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
  if (!from) throw new ReturnNotAllowed('This order has no address to collect from.', ctx.storeId)
  const [s] = await ctx.tx.select().from(store).where(eq(store.id, ctx.storeId))
  const settings = parseShippingSettings(s?.shipping)
  // Back to the location the returned goods left from, when it has courier pickup on.
  const backTo = await shipFromFor(ctx.tx, {
    taxOrigin: o.taxOrigin,
    locationId: await returnPickupLocation(ctx, id),
    settings,
    storeName: s?.name ?? '',
  })
  const lines = await ctx.tx
    .select({
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      unitPricePaise: orderLine.unitPricePaise,
      quantity: returnRequestLine.quantity,
      variantWeightGrams: variant.weightGrams,
    })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .where(eq(returnRequestLine.returnRequestId, id))
  const boxWeight = defaultBoxPreset(settings)?.weightGrams ?? ASSUMED_WEIGHT_GRAMS
  const result = await provider.createReturnPickup({
    returnId: r.id,
    reference: `${returnLabel(r.number)}-${o.number}`,
    orderNumber: o.number,
    from: {
      name: from.name,
      line1: from.line1,
      line2: from.line2 ?? undefined,
      city: from.city,
      state: from.stateCode,
      pincode: from.pincode,
      country: from.country,
      phone: from.phone,
    },
    to: backTo.address,
    lines: lines.map((l) => ({
      title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
        .filter(Boolean)
        .join(' / '),
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
    })),
    valuePaise: lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0),
    weightGrams: resolveParcelWeightGrams(lines, boxWeight),
  })
  return setReturn(ctx, id, {
    status: 'in_transit',
    pickupMethod: 'courier',
    pickupProvider: provider.id,
    pickupWaybill: result.waybill,
    pickupLabelUrl: result.labelUrl ?? null,
    pickupArrangedAt: new Date(),
  })
}

/** The location a variant mainly sells from online (`primarySellingLevel`). */
export async function sellingLocation(
  ctx: StoreContext,
  variantId: string,
): Promise<string | undefined> {
  const [level] = await ctx.tx
    .select({ locationId: inventoryLevel.locationId })
    .from(inventoryLevel)
    .where(and(eq(inventoryLevel.variantId, variantId), primarySellingLevel(variantId)))
  return level?.locationId ?? undefined
}

/**
 * Where a courier brings a return: the location the most of its value left from (an order
 * shipped in parcels from two warehouses may return goods from either). Undefined when none of
 * its lines were packed from a parcel (the order's tax origin then decides).
 */
export async function returnPickupLocation(
  ctx: StoreContext,
  returnId: string,
): Promise<string | undefined> {
  const lines = await ctx.tx
    .select({
      orderLineId: returnRequestLine.orderLineId,
      quantity: returnRequestLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
    })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, returnId))
  const value = new Map<string, number>()
  for (const l of lines) {
    const at = await lineLocation(ctx, l.orderLineId)
    if (at) value.set(at, (value.get(at) ?? 0) + l.quantity * l.unitPricePaise)
  }
  return [...value].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
}

/**
 * Where returned units of an order line go back to: the location its parcel left from, else
 * (an order line no parcel packed) where the variant sells from.
 */
export async function returnLocation(
  ctx: StoreContext,
  line: { orderLineId: string; variantId: string },
): Promise<string | undefined> {
  return (await lineLocation(ctx, line.orderLineId)) ?? sellingLocation(ctx, line.variantId)
}

/**
 * Put a return's items back in stock, logged as "returned". Only the units not
 * restocked yet move, so a second click is harmless.
 */
export async function restockReturn(ctx: StoreContext, id: string) {
  const r = await lockReturn(ctx, id)
  expect(ctx, r, ['received', 'resolved'], 'restocked before it arrives')
  if (r.resolution === 'reship') {
    throw new ReturnNotAllowed(
      'These items were sent out again, so they are not in stock.',
      ctx.storeId,
    )
  }
  const lines = await ctx.tx
    .select({
      id: returnRequestLine.id,
      quantity: returnRequestLine.quantity,
      restocked: returnRequestLine.restockedQuantity,
      orderLineId: returnRequestLine.orderLineId,
      variantId: orderLine.variantId,
    })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, id))
  let moved = 0
  for (const l of lines) {
    const remaining = l.quantity - l.restocked
    if (remaining <= 0) continue
    await adjustStock(ctx.tx, {
      storeId: ctx.storeId,
      variantId: l.variantId,
      locationId: await returnLocation(ctx, l),
      delta: remaining,
      reason: 'returned',
      note: `${r.kind === 'rto' ? 'RTO' : 'Return'} ${returnLabel(r.number)}`,
    })
    await ctx.tx
      .update(returnRequestLine)
      .set({ restockedQuantity: l.quantity })
      .where(eq(returnRequestLine.id, l.id))
    moved += remaining
  }
  const row = await setReturn(ctx, id, { restock: true, restockedAt: r.restockedAt ?? new Date() })
  return { row, moved }
}

export type ReceiveReturnInput = {
  condition: 'good' | 'damaged' | 'used'
  note?: string | null | undefined
  /** Override the store's "restock automatically" rule for this parcel. */
  restock?: boolean | undefined
}

/**
 * The parcel arrived. Record its condition; items in good condition go back
 * in stock when the store restocks automatically (or when asked here).
 */
export async function receiveReturn(ctx: StoreContext, id: string, input: ReceiveReturnInput) {
  const r = await lockReturn(ctx, id)
  if (r.kind !== 'return') throw new ReturnNotAllowed('An RTO is already received', ctx.storeId)
  expect(ctx, r, ['approved', 'in_transit'], 'marked received')
  const policy = await loadReturnPolicy(ctx)
  const restock = input.restock ?? (policy.restockAutomatically && input.condition === 'good')
  await setReturn(ctx, id, {
    status: 'received',
    receivedAt: new Date(),
    condition: input.condition,
    conditionNote: input.note?.trim() || null,
    restock,
  })
  if (restock) await restockReturn(ctx, id)
  await recomputeOrderStatuses(ctx, r.orderId)
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'return.received', {
    orderId: r.orderId,
    returnId: r.id,
  })
  return lockReturn(ctx, id)
}

/** Finish a return with nothing further (e.g. an RTO the merchant only restocks). */
export async function closeReturn(ctx: StoreContext, id: string) {
  const r = await lockReturn(ctx, id)
  expect(ctx, r, ['received'], 'closed')
  return setReturn(ctx, id, { status: 'resolved', resolution: 'none', resolvedAt: new Date() })
}

/** What the courier charged for an RTO, typed by the merchant for the Shipments totals. */
export async function setReturnCourierCost(ctx: StoreContext, id: string, paise: number | null) {
  await lockReturn(ctx, id)
  if (paise !== null && (!Number.isInteger(paise) || paise < 0)) {
    throw new ReturnNotAllowed('Enter the charge in rupees.', ctx.storeId)
  }
  return setReturn(ctx, id, { courierCostPaise: paise })
}

export { setReturn as updateReturnRow }

export type ReturnListFilter = {
  page?: number | undefined
  perPage?: number | undefined
  status?: ReturnStatus[] | undefined
  kind?: 'return' | 'rto' | undefined
  search?: string | undefined
}

/** The admin Returns list: newest first, with the order and customer it belongs to. */
export async function listReturns(ctx: StoreContext, filter: ReturnListFilter = {}) {
  const page = Math.max(1, filter.page ?? 1)
  const perPage = Math.min(100, Math.max(1, filter.perPage ?? 25))
  const conds = [eq(returnRequest.storeId, ctx.storeId)]
  if (filter.status?.length) conds.push(inArray(returnRequest.status, filter.status))
  if (filter.kind) conds.push(eq(returnRequest.kind, filter.kind))
  const q = filter.search?.trim().replace(/^#|^r-/i, '')
  if (q) {
    const n = Number(q)
    const text = `%${q}%`
    const match = or(
      ilike(order.email, text),
      ilike(customer.name, text),
      ...(Number.isInteger(n) && n > 0 ? [eq(order.number, n), eq(returnRequest.number, n)] : []),
    )
    if (match) conds.push(match)
  }
  const where = and(...conds)
  const [rows, [total]] = await Promise.all([
    ctx.tx
      .select({
        id: returnRequest.id,
        number: returnRequest.number,
        kind: returnRequest.kind,
        status: returnRequest.status,
        resolution: returnRequest.resolution,
        reason: returnRequest.reason,
        requestedAt: returnRequest.requestedAt,
        orderId: order.id,
        orderNumber: order.number,
        email: order.email,
        customerName: customer.name,
        items: sql<number>`(select coalesce(sum(${returnRequestLine.quantity}), 0)::int from ${returnRequestLine} where ${returnRequestLine.returnRequestId} = ${returnRequest.id})`,
        valuePaise: sql<number>`(select coalesce(sum(${returnRequestLine.quantity} * ${orderLine.unitPricePaise}), 0)::int from ${returnRequestLine} join ${orderLine} on ${orderLine.id} = ${returnRequestLine.orderLineId} where ${returnRequestLine.returnRequestId} = ${returnRequest.id})`,
      })
      .from(returnRequest)
      .innerJoin(order, eq(order.id, returnRequest.orderId))
      .leftJoin(customer, eq(customer.id, order.customerId))
      .where(where)
      .orderBy(desc(returnRequest.requestedAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    ctx.tx
      .select({ n: count() })
      .from(returnRequest)
      .innerJoin(order, eq(order.id, returnRequest.orderId))
      .leftJoin(customer, eq(customer.id, order.customerId))
      .where(where),
  ])
  return {
    items: rows.map((r) => ({
      ...r,
      label: returnLabel(r.number),
      items: Number(r.items),
      valuePaise: Number(r.valuePaise),
    })),
    total: Number(total?.n ?? 0),
    page,
    perPage,
  }
}

/** Counts for the Returns tabs. */
export async function returnCounts(ctx: StoreContext) {
  const rows = await ctx.tx
    .select({ status: returnRequest.status, kind: returnRequest.kind, n: count() })
    .from(returnRequest)
    .where(eq(returnRequest.storeId, ctx.storeId))
    .groupBy(returnRequest.status, returnRequest.kind)
  const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).reduce((s, r) => s + Number(r.n), 0)
  return {
    all: sum(() => true),
    requested: sum((r) => r.status === 'requested'),
    inProgress: sum((r) => r.status === 'approved' || r.status === 'in_transit'),
    received: sum((r) => r.status === 'received'),
    rto: sum((r) => r.kind === 'rto'),
    /** RTO parcels back with the merchant, waiting for restock and a refund or re-ship. */
    rtoOpen: sum((r) => r.kind === 'rto' && r.status === 'received'),
  }
}

/** One return with its lines and the order around it, for the admin detail page. */
export async function getReturn(ctx: StoreContext, id: string) {
  const [r] = await ctx.tx.select().from(returnRequest).where(eq(returnRequest.id, id))
  if (!r) return null
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, r.orderId))
  if (!o) return null
  const lines = await orderLinesWithImages(ctx, o.id)
  const [view] = await returnsWithLines(ctx, [r], new Map([[o.id, lines]]))
  const [cu] = o.customerId
    ? await ctx.tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const [addr] = o.shippingAddressId
    ? await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const [exchange] = r.exchangeOrderId
    ? await ctx.tx
        .select({ id: order.id, number: order.number, status: order.status })
        .from(order)
        .where(eq(order.id, r.exchangeOrderId))
    : []
  return {
    ...(view as ReturnView),
    order: {
      id: o.id,
      number: o.number,
      status: o.status,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      paymentMethod: o.paymentMethod,
      totalPaise: o.totalPaise,
      subtotalPaise: o.subtotalPaise,
      discountPaise: o.discountPaise,
      shippingPaise: o.shippingPaise,
      email: o.email,
      phone: o.phone,
      customerId: o.customerId,
      customerName: cu?.name ?? null,
      address: addr
        ? {
            name: addr.name,
            line1: addr.line1,
            line2: addr.line2,
            city: addr.city,
            stateCode: addr.stateCode,
            pincode: addr.pincode,
            phone: addr.phone,
          }
        : null,
    },
    exchangeOrder: exchange ?? null,
  }
}
