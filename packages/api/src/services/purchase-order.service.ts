import { convertToPaise, type PurchaseOrderStatus, purchaseOrderTotals } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  inboundShipment,
  location,
  media,
  product,
  productMedia,
  purchaseCharge,
  purchaseOrder,
  purchaseOrderLine,
  supplier,
  variant,
} from '@commerce/db'
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'

// Services are the only code that runs queries. They receive a store-scoped tx.

export type PurchaseOrderStatusFilter = 'all' | PurchaseOrderStatus

/**
 * What the search box means by a number: `12`, `#12`, `PO12`, `#PO12` and `po 12`
 * all find order 12. Anything else is a supplier name.
 */
function purchaseOrderNumberFromSearch(term: string): number | null {
  const m = term.trim().match(/^#?\s*(?:po)?\s*#?\s*(\d{1,9})$/i)
  return m?.[1] ? Number(m[1]) : null
}

/** Each order's own charges in paise, GST included: what the order costs to pay for. */
async function chargesByOrder(tx: StoreTx, orderIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (orderIds.length === 0) return out
  const rows = await tx
    .select({
      purchaseOrderId: purchaseCharge.purchaseOrderId,
      amountMinor: purchaseCharge.amountMinor,
      currency: purchaseCharge.currency,
      fxRate: purchaseCharge.fxRate,
      gstPaise: purchaseCharge.gstPaise,
    })
    .from(purchaseCharge)
    .where(inArray(purchaseCharge.purchaseOrderId, orderIds))
  for (const r of rows) {
    if (!r.purchaseOrderId) continue
    const paise = convertToPaise(r.amountMinor, r.currency, r.fxRate) + r.gstPaise
    out.set(r.purchaseOrderId, (out.get(r.purchaseOrderId) ?? 0) + paise)
  }
  return out
}

type OrderMoney = { id: string; currency: string; fxRate: string }
type LineMoney = { quantity: number; unitPriceMinor: number }

const goodsOf = (po: OrderMoney, l: LineMoney) =>
  convertToPaise(l.quantity * l.unitPriceMinor, po.currency, po.fxRate)

export async function listPurchaseOrders(
  tx: StoreTx,
  q: {
    status?: PurchaseOrderStatusFilter | undefined
    search?: string | undefined
    page: number
    perPage: number
  },
) {
  const term = q.search?.trim()
  const number = term ? purchaseOrderNumberFromSearch(term) : null
  const where = and(
    q.status && q.status !== 'all' ? eq(purchaseOrder.status, q.status) : undefined,
    term
      ? or(
          ilike(purchaseOrder.supplierName, `%${term}%`),
          ilike(purchaseOrder.name, `%${term}%`),
          number === null ? undefined : eq(purchaseOrder.number, number),
        )
      : undefined,
  )
  const orders = await tx
    .select({
      id: purchaseOrder.id,
      number: purchaseOrder.number,
      name: purchaseOrder.name,
      supplierName: purchaseOrder.supplierName,
      status: purchaseOrder.status,
      locationName: location.name,
      expectedAt: purchaseOrder.expectedAt,
      currency: purchaseOrder.currency,
      fxRate: purchaseOrder.fxRate,
      inboundShipmentId: purchaseOrder.inboundShipmentId,
      createdAt: purchaseOrder.createdAt,
    })
    .from(purchaseOrder)
    .innerJoin(location, eq(location.id, purchaseOrder.locationId))
    .where(where)
    .orderBy(desc(purchaseOrder.number))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage)
  const [total] = await tx.select({ n: count() }).from(purchaseOrder).where(where)
  const ids = orders.map((o) => o.id)
  const lines = ids.length
    ? await tx
        .select({
          purchaseOrderId: purchaseOrderLine.purchaseOrderId,
          quantity: purchaseOrderLine.quantity,
          received: purchaseOrderLine.received,
          rejected: purchaseOrderLine.rejected,
          unitPriceMinor: purchaseOrderLine.unitPriceMinor,
        })
        .from(purchaseOrderLine)
        .where(inArray(purchaseOrderLine.purchaseOrderId, ids))
    : []
  const charges = await chargesByOrder(tx, ids)
  return {
    rows: orders.map((o) => ({
      ...o,
      ...purchaseOrderTotals(
        lines
          .filter((l) => l.purchaseOrderId === o.id)
          .map((l) => ({ ...l, goodsPaise: goodsOf(o, l) })),
        charges.get(o.id) ?? 0,
      ),
    })),
    total: Number(total?.n ?? 0),
  }
}

export async function purchaseOrderCounts(tx: StoreTx) {
  const rows = await tx
    .select({ status: purchaseOrder.status, n: count() })
    .from(purchaseOrder)
    .groupBy(purchaseOrder.status)
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]))
  const incoming = await tx
    .select({
      units:
        sql<number>`coalesce(sum(greatest(0, ${purchaseOrderLine.quantity} - ${purchaseOrderLine.received} - ${purchaseOrderLine.rejected})), 0)`.mapWith(
          Number,
        ),
    })
    .from(purchaseOrderLine)
    .innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
    .where(inArray(purchaseOrder.status, ['ordered', 'partially_received']))
  return {
    draft: by.draft ?? 0,
    open: (by.ordered ?? 0) + (by.partially_received ?? 0),
    received: by.received ?? 0,
    closed: by.closed ?? 0,
    cancelled: by.cancelled ?? 0,
    incomingUnits: incoming[0]?.units ?? 0,
  }
}

export async function lineDetails(
  tx: StoreTx,
  variantIds: string[],
): Promise<
  Map<
    string,
    { productTitle: string; variantTitle: string; sku: string | null; imageUrl: string | null }
  >
> {
  const out = new Map<
    string,
    { productTitle: string; variantTitle: string; sku: string | null; imageUrl: string | null }
  >()
  if (variantIds.length === 0) return out
  const rows = await tx
    .select({
      id: variant.id,
      productId: product.id,
      productTitle: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(inArray(variant.id, variantIds))
  const covers = await tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(
      and(
        inArray(productMedia.productId, [...new Set(rows.map((r) => r.productId))]),
        eq(productMedia.position, 0),
      ),
    )
  const cover = new Map(covers.map((c) => [c.productId, c.url]))
  for (const r of rows) {
    out.set(r.id, {
      productTitle: r.productTitle,
      variantTitle: r.variantTitle,
      sku: r.sku,
      imageUrl: cover.get(r.productId) ?? null,
    })
  }
  return out
}

export async function getPurchaseOrder(tx: StoreTx, id: string) {
  const [po] = await tx.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
  if (!po) return null
  const lines = await tx
    .select()
    .from(purchaseOrderLine)
    .where(eq(purchaseOrderLine.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderLine.id))
  const details = await lineDetails(
    tx,
    lines.map((l) => l.variantId),
  )
  const [linkedSupplier] = po.supplierId
    ? await tx
        .select({ id: supplier.id, name: supplier.name, currency: supplier.currency })
        .from(supplier)
        .where(eq(supplier.id, po.supplierId))
    : []
  const [shipment] = po.inboundShipmentId
    ? await tx
        .select({
          id: inboundShipment.id,
          number: inboundShipment.number,
          reference: inboundShipment.reference,
        })
        .from(inboundShipment)
        .where(eq(inboundShipment.id, po.inboundShipmentId))
    : []
  const charges = await chargesByOrder(tx, [po.id])
  return {
    ...po,
    supplier: linkedSupplier ?? null,
    shipment: shipment ?? null,
    lines: lines.map((l) => ({
      ...l,
      productTitle: details.get(l.variantId)?.productTitle ?? '',
      variantTitle: details.get(l.variantId)?.variantTitle ?? '',
      sku: details.get(l.variantId)?.sku ?? null,
      imageUrl: details.get(l.variantId)?.imageUrl ?? null,
    })),
    totals: purchaseOrderTotals(
      lines.map((l) => ({ ...l, goodsPaise: goodsOf(po, l) })),
      charges.get(po.id) ?? 0,
    ),
  }
}
