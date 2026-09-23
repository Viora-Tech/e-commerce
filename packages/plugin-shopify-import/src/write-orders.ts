/**
 * Historical orders. Written straight to the order tables and flagged
 * `imported_from = 'shopify'`: no workflow, so no stock is reserved or moved,
 * no notification or app event is queued (which is also what feeds GST
 * invoicing), and the admin treats the order as read-only.
 */
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
  store,
  variant,
} from '@commerce/db'
import { and, eq, ilike, isNull, sql } from 'drizzle-orm'
import { countryFor, stateFor } from './address'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import type { NOrder, NOrderLine } from './types'

export const PLACEHOLDER_HANDLE = 'imported-historical-item'
const PAID = new Set(['paid', 'partially_refunded', 'refunded', 'partially_paid'])

export const orderSourceId = (o: Pick<NOrder, 'sourceId' | 'name'>) =>
  o.sourceId ?? `name:${o.name}`

type Status = 'placed' | 'paid' | 'fulfilled' | 'delivered' | 'cancelled'

/** Our single order status from Shopify's financial and fulfilment pair. */
export function statusFor(
  o: Pick<NOrder, 'cancelledAt' | 'financialStatus' | 'fulfillmentStatus'>,
): Status {
  if (o.cancelledAt) return 'cancelled'
  const fulfilled = o.fulfillmentStatus === 'fulfilled'
  const paid = PAID.has(o.financialStatus ?? '')
  if (fulfilled) return 'fulfilled'
  if (paid) return 'paid'
  return 'placed'
}

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

async function customerFor(tx: StoreTx, storeId: string, o: NOrder): Promise<string | null> {
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
      .where(eq(customer.phone, o.phone))
    if (row) return row.id
  }
  const [created] = await tx
    .insert(customer)
    .values({
      storeId,
      email: o.email,
      phone: o.phone,
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

async function nextNumber(tx: StoreTx, storeId: string): Promise<number> {
  const [row] = await tx
    .update(store)
    .set({ nextOrderNumber: sql`${store.nextOrderNumber} + 1` })
    .where(eq(store.id, storeId))
    .returning({ next: store.nextOrderNumber })
  return (row?.next ?? 2) - 1
}

/** New orders continue after the highest imported number, as they did on Shopify. */
async function bumpCounter(tx: StoreTx, storeId: string, number: number) {
  await tx
    .update(store)
    .set({ nextOrderNumber: sql`greatest(${store.nextOrderNumber}, ${number + 1})` })
    .where(eq(store.id, storeId))
}

export async function writeOrder(
  ctx: ImportContext,
  o: NOrder,
  cache: Map<string, string> = new Map(),
): Promise<string | null> {
  try {
    const existing = await ctx.inStore((tx) => existingOrder(tx, o))
    if (existing && !existing.importedFrom) {
      ctx.report.count('orders', 'skipped')
      ctx.report.issue({
        resource: 'orders',
        row: o.row,
        ref: o.name,
        message: `Order number ${o.number} already belongs to an order placed in this store; skipped`,
      })
      if (ctx.dryRun) {
        ctx.report.sample({ resource: 'orders', key: o.name, title: o.name, action: 'skip' })
      }
      return null
    }
    if (ctx.dryRun) {
      ctx.report.count('orders', existing ? 'updated' : 'created')
      ctx.report.sample({
        resource: 'orders',
        key: o.name,
        title: `${o.name}${o.customerName ? `, ${o.customerName}` : ''}`,
        action: existing ? 'update' : 'create',
        detail: `${o.lines.length} ${o.lines.length === 1 ? 'line' : 'lines'}, ${statusFor(o)}`,
      })
      return existing?.id ?? null
    }

    const id = await ctx.inStore(async (tx) => {
      const customerId = await customerFor(tx, ctx.storeId, o)
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
      const fields = {
        customerId,
        email: o.email,
        phone: o.phone,
        shippingAddressId,
        paymentMethod: null,
        status: statusFor(o),
        subtotalPaise: o.subtotalPaise,
        shippingPaise: o.shippingPaise,
        discountCode: o.discountCode,
        discountLabel: o.discountCode,
        discountPaise: o.discountPaise,
        totalPaise: o.totalPaise,
        taxPaise: o.taxPaise,
        tags: o.tags.slice(0, 20),
        placedAt: o.createdAt ? new Date(o.createdAt) : new Date(),
        importedFrom: 'shopify',
        importMeta: meta,
      }
      let orderId: string
      if (existing) {
        orderId = existing.id
        await tx.update(order).set(fields).where(eq(order.id, orderId))
        // Lines and the payment record are rebuilt: nothing else points at them.
        await tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
        await tx.delete(payment).where(eq(payment.orderId, orderId))
      } else {
        orderId = newId()
        const number = o.number ?? (await nextNumber(tx, ctx.storeId))
        await tx.insert(order).values({ id: orderId, storeId: ctx.storeId, number, ...fields })
        await bumpCounter(tx, ctx.storeId, number)
      }
      for (const line of o.lines) {
        const v = await variantFor(tx, ctx.storeId, line, cache)
        await tx.insert(orderLine).values({
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
      await saveMapping(tx, ctx.storeId, 'orders', orderSourceId(o), orderId)
      return orderId
    })
    ctx.report.count('orders', existing ? 'updated' : 'created')
    return id
  } catch (err) {
    ctx.report.count('orders', 'failed')
    ctx.report.issue({ resource: 'orders', row: o.row, ref: o.name, message: errorMessage(err) })
    return null
  }
}
