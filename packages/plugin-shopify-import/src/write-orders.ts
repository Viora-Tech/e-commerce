/**
 * Historical orders. Written straight to the order tables and flagged
 * `imported_from = 'shopify'`: no workflow, so no stock is reserved or moved,
 * no notification or app event is queued (which is also what feeds GST
 * invoicing), and the admin treats the order as read-only.
 */

import {
  bumpOrderNumberPast,
  deleteFulfillmentOrders,
  encryptCustomerPhone,
  importedOrderStatuses,
  phoneBlindIndex,
  recomputeOrderStatuses,
  SETTLED_PAYMENT_STATUSES,
  takeOrderNumber,
} from '@commerce/core'
import {
  address,
  customer,
  newId,
  type OrderImportMeta,
  order,
  orderLine,
  payment,
  product,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, eq, ilike, isNull, sql } from 'drizzle-orm'
import { countryFor, stateFor } from './address'
import {
  errorMessage,
  findMapping,
  type ImportContext,
  type MappingRow,
  saveMapping,
  saveMappings,
  writeBatch,
} from './runtime'
import type { NOrder, NOrderLine } from './types'

export const PLACEHOLDER_HANDLE = 'imported-historical-item'
const PAID = new Set(['paid', 'partially_refunded', 'refunded', 'partially_paid'])

export const orderSourceId = (o: Pick<NOrder, 'sourceId' | 'name'>) =>
  o.sourceId ?? `name:${o.name}`

/**
 * Our lifecycle, payment and fulfilment statuses from Shopify's financial and
 * fulfilment pair (`importedOrderStatuses` in core, shared with the
 * recompute so both read the source the same way).
 */
export function statusFor(
  o: Pick<NOrder, 'cancelledAt' | 'financialStatus' | 'fulfillmentStatus'>,
): ReturnType<typeof importedOrderStatuses> {
  return importedOrderStatuses(o)
}

/** One word for the dry-run preview: cancelled, completed, or where the goods are. */
const previewStatus = (s: ReturnType<typeof statusFor>): string =>
  s.status === 'open' ? `${s.fulfillmentStatus}, ${s.paymentStatus}` : s.status

/**
 * An archived product holding lines whose product no longer exists (deleted on
 * Shopify, or never imported). Lines keep their own title snapshot.
 */
async function placeholderVariant(tx: StoreTx, storeId: string): Promise<string> {
  const [found] = await tx
    .select({ id: variant.id })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(product.handle, PLACEHOLDER_HANDLE))
    .limit(1)
  if (found) return found.id
  const productId = newId()
  await tx.insert(product).values({
    id: productId,
    storeId,
    handle: PLACEHOLDER_HANDLE,
    title: 'Historical item (imported)',
    status: 'archived',
    tags: ['imported'],
  })
  const id = newId()
  await tx.insert(variant).values({
    id,
    storeId,
    productId,
    title: 'Default Title',
    pricePaise: 0,
    trackInventory: false,
    archivedAt: new Date(),
  })
  return id
}

/** SKU, then product handle, then "Product - Variant" title; else the placeholder. */
async function variantFor(
  tx: StoreTx,
  storeId: string,
  line: NOrderLine,
  cache: Map<string, string>,
): Promise<{ id: string; variantTitle: string | null; hsCode: string | null }> {
  const lookup = async () => {
    if (line.sku) {
      const [bySku] = await tx
        .select({ id: variant.id, title: variant.title, hsCode: variant.hsCode })
        .from(variant)
        .where(eq(variant.sku, line.sku))
        .orderBy(sql`${variant.archivedAt} nulls first`)
        .limit(1)
      if (bySku) return bySku
    }
    const candidates = line.productHandle
      ? await tx
          .select({ id: variant.id, title: variant.title, hsCode: variant.hsCode })
          .from(variant)
          .innerJoin(product, eq(product.id, variant.productId))
          .where(and(eq(product.handle, line.productHandle), isNull(variant.archivedAt)))
      : []
    const wanted = line.variantTitle ?? 'Default Title'
    const byHandle = candidates.find((c) => c.title === wanted) ?? candidates[0]
    if (byHandle) return byHandle
    // CSV names read "Product - Variant"; try the longest product title that prefixes it.
    const parts = line.title.split(' - ')
    for (let cut = parts.length; cut >= 1; cut--) {
      const title = parts.slice(0, cut).join(' - ')
      const rest = parts.slice(cut).join(' - ') || 'Default Title'
      const rows = await tx
        .select({ id: variant.id, title: variant.title, hsCode: variant.hsCode })
        .from(variant)
        .innerJoin(product, eq(product.id, variant.productId))
        .where(ilike(product.title, title))
      const hit = rows.find((r) => r.title === rest) ?? (rows.length === 1 ? rows[0] : undefined)
      if (hit) return hit
    }
    return null
  }
  const key = `${line.sku ?? ''}|${line.productHandle ?? ''}|${line.title}|${line.variantTitle ?? ''}`
  const hit = await lookup()
  if (hit) return { id: hit.id, variantTitle: line.variantTitle ?? hit.title, hsCode: hit.hsCode }
  let id = cache.get('placeholder')
  if (!id) {
    id = await placeholderVariant(tx, storeId)
    cache.set('placeholder', id)
  }
  cache.set(key, id)
  return { id, variantTitle: line.variantTitle, hsCode: null }
}

/**
 * `customer.phone` is encrypted, so matching by phone is by blind index
 * (`customer.phone_index`), same as `write-customers.ts#matchCustomer` — see
 * `packages/core/src/customers/phone-crypto.ts`.
 */
async function customerFor(
  tx: StoreTx,
  storeId: string,
  o: NOrder,
  secret: string,
): Promise<string | null> {
  if (!o.email && !o.phone) return null
  if (o.email) {
    const [row] = await tx
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.email, o.email))
    if (row) return row.id
  } else if (o.phone) {
    const [row] = await tx
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.phoneIndex, phoneBlindIndex(o.phone, secret)))
    if (row) return row.id
  }
  // A new buyer's contact phone: the order's, else the shipping address's (as checkout does).
  const phone = o.phone || o.shippingAddress?.phone || null
  const [created] = await tx
    .insert(customer)
    .values({
      storeId,
      email: o.email,
      // Stored encrypted, the same as the admin and checkout paths (docs/security/data-protection.md).
      phone: phone ? encryptCustomerPhone(phone, secret).cipher : null,
      phoneIndex: phone ? phoneBlindIndex(phone, secret) : null,
      name: o.customerName,
      ...(o.createdAt ? { createdAt: new Date(o.createdAt) } : {}),
    })
    .returning({ id: customer.id })
  return created?.id ?? null
}

type Existing = { id: string; importedFrom: string | null } | null

async function existingOrder(tx: StoreTx, o: NOrder): Promise<Existing> {
  const mapped = await findMapping(tx, 'orders', orderSourceId(o))
  if (mapped) {
    const [row] = await tx
      .select({ id: order.id, importedFrom: order.importedFrom })
      .from(order)
      .where(eq(order.id, mapped))
    if (row) return row
  }
  if (o.number === null) return null
  const [byNumber] = await tx
    .select({ id: order.id, importedFrom: order.importedFrom })
    .from(order)
    .where(eq(order.number, o.number))
  return byNumber ?? null
}

/** The store's next order number (`store_counter`, shared with checkout and drafts). */
const nextNumber = (tx: StoreTx, storeId: string): Promise<number> => takeOrderNumber(tx, storeId)

/** New orders continue after the highest imported number, as they did on Shopify. */
const bumpCounter = (tx: StoreTx, storeId: string, number: number): Promise<void> =>
  bumpOrderNumberPast(tx, storeId, number)

type Outcome = {
  outcome: 'created' | 'updated' | 'skipped'
  id: string | null
  existing: Existing
}

/**
 * Everything one order writes, against the caller's transaction. A dry run
 * stops after the lookup. With `mappings`, the mapping row is collected for
 * one multi-row statement at the end of the batch instead of written here.
 */
async function applyOrder(
  tx: StoreTx,
  ctx: ImportContext,
  o: NOrder,
  cache: Map<string, string>,
  mappings?: MappingRow[],
): Promise<Outcome> {
  const existing = await existingOrder(tx, o)
  if (existing && !existing.importedFrom) return { outcome: 'skipped', id: null, existing }
  if (ctx.dryRun) {
    return { outcome: existing ? 'updated' : 'created', id: existing?.id ?? null, existing }
  }
  const customerId = await customerFor(tx, ctx.storeId, o, ctx.secret)
  let shippingAddressId: string | null = null
  if (o.shippingAddress) {
    const a = o.shippingAddress
    const [row] = await tx
      .insert(address)
      .values({
        storeId: ctx.storeId,
        name: a.name || o.customerName || '',
        line1: [a.company, a.line1].filter(Boolean).join(', '),
        line2: a.line2,
        city: a.city,
        stateCode: stateFor(a),
        pincode: a.zip.replace(/\s/g, ''),
        country: countryFor(a),
        phone: a.phone ?? o.phone ?? '',
      })
      .returning({ id: address.id })
    shippingAddressId = row?.id ?? null
  }
  const meta: OrderImportMeta = {
    name: o.name,
    sourceId: o.sourceId,
    financialStatus: o.financialStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    paymentMethod: o.paymentMethod,
    cancelledAt: o.cancelledAt,
    refundedPaise: o.refundedPaise || null,
  }
  const statuses = statusFor(o)
  const placedAt = o.createdAt ? new Date(o.createdAt) : new Date()
  const fields = {
    customerId,
    email: o.email,
    phone: o.phone,
    shippingAddressId,
    paymentMethod: null,
    ...statuses,
    checkoutPaidAt: SETTLED_PAYMENT_STATUSES.includes(statuses.paymentStatus) ? placedAt : null,
    subtotalPaise: o.subtotalPaise,
    shippingPaise: o.shippingPaise,
    discountCode: o.discountCode,
    discountLabel: o.discountCode,
    discountPaise: o.discountPaise,
    totalPaise: o.totalPaise,
    taxPaise: o.taxPaise,
    tags: o.tags.slice(0, 20),
    placedAt,
    importedFrom: 'shopify',
    importMeta: meta,
  }
  let orderId: string
  if (existing) {
    orderId = existing.id
    await tx.update(order).set(fields).where(eq(order.id, orderId))
    // Lines and the payment record are rebuilt: nothing else points at them (parcels made
    // for the old lines by the 0096 backfill go with them).
    await deleteFulfillmentOrders(tx, orderId)
    await tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
    await tx.delete(payment).where(eq(payment.orderId, orderId))
  } else {
    orderId = newId()
    const number = o.number ?? (await nextNumber(tx, ctx.storeId))
    await tx.insert(order).values({ id: orderId, storeId: ctx.storeId, number, ...fields })
    await bumpCounter(tx, ctx.storeId, number)
  }
  const lines = []
  for (const line of o.lines) {
    const v = await variantFor(tx, ctx.storeId, line, cache)
    lines.push({
      storeId: ctx.storeId,
      orderId,
      variantId: v.id,
      title: line.title.slice(0, 300),
      variantTitle: v.variantTitle,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      fulfilledQuantity: Math.min(line.fulfilledQuantity, line.quantity),
      hsCode: v.hsCode,
    })
  }
  // One statement for every line of the order.
  if (lines.length) await tx.insert(orderLine).values(lines)
  if (PAID.has(o.financialStatus ?? '') && o.totalPaise > 0) {
    await tx.insert(payment).values({
      storeId: ctx.storeId,
      orderId,
      provider: 'shopify',
      providerRef: (o.paymentReference ?? o.name).slice(0, 200),
      status: o.financialStatus === 'refunded' ? 'refunded' : 'captured',
      amountPaise: o.totalPaise,
    })
  }
  // Same derivation the recompute applies to imported orders; it never writes events for them.
  await recomputeOrderStatuses({ storeId: ctx.storeId, tx }, orderId)
  if (mappings) mappings.push({ sourceId: orderSourceId(o), localId: orderId })
  else await saveMapping(tx, ctx.storeId, 'orders', orderSourceId(o), orderId)
  return { outcome: existing ? 'updated' : 'created', id: orderId, existing }
}

/** Counts, the skip reason, and on a dry run the sample: the same for one order or a batch. */
function reportOrder(ctx: ImportContext, o: NOrder, r: Outcome) {
  ctx.report.count('orders', r.outcome)
  if (r.outcome === 'skipped') {
    ctx.report.issue({
      resource: 'orders',
      row: o.row,
      ref: o.name,
      message: `Order number ${o.number} already belongs to an order placed in this store; skipped`,
    })
    if (ctx.dryRun) {
      ctx.report.sample({ resource: 'orders', key: o.name, title: o.name, action: 'skip' })
    }
    return
  }
  if (ctx.dryRun) {
    ctx.report.sample({
      resource: 'orders',
      key: o.name,
      title: `${o.name}${o.customerName ? `, ${o.customerName}` : ''}`,
      action: r.existing ? 'update' : 'create',
      detail: `${o.lines.length} ${o.lines.length === 1 ? 'line' : 'lines'}, ${previewStatus(statusFor(o))}`,
    })
  }
}

export async function writeOrder(
  ctx: ImportContext,
  o: NOrder,
  cache: Map<string, string> = new Map(),
): Promise<string | null> {
  try {
    const r = await ctx.inStore((tx) => applyOrder(tx, ctx, o, cache))
    reportOrder(ctx, o, r)
    return r.id
  } catch (err) {
    ctx.report.count('orders', 'failed')
    ctx.report.issue({
      resource: 'orders',
      row: o.row,
      ref: o.name,
      sourceId: orderSourceId(o),
      message: errorMessage(err),
    })
    return null
  }
}

/**
 * A batch of orders in one transaction, still one after another (they resolve
 * or create customers and the placeholder item through shared lookups), with
 * each order's lines in one statement and the batch's mappings in one more.
 * A failure rolls the batch back and writes it one order at a time.
 */
export async function writeOrders(
  ctx: ImportContext,
  batch: readonly NOrder[],
  cache: Map<string, string>,
): Promise<void> {
  const before = new Map(cache)
  await writeBatch(ctx, batch, {
    batch: async (tx, items) => {
      const mappings: MappingRow[] = []
      const out: Outcome[] = []
      for (const o of items) out.push(await applyOrder(tx, ctx, o, cache, mappings))
      await saveMappings(tx, ctx.storeId, 'orders', mappings)
      return out
    },
    report: (o, r) => reportOrder(ctx, o, r),
    one: (o) => writeOrder(ctx, o, cache),
    // The placeholder item the rolled-back batch made is gone with it.
    onRollback: () => {
      cache.clear()
      for (const [k, v] of before) cache.set(k, v)
    },
  })
}
