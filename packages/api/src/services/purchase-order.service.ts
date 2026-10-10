import { type PurchaseOrderStatus, purchaseOrderTotals } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  location,
  media,
  product,
  productMedia,
  purchaseOrder,
  purchaseOrderLine,
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
          number === null ? undefined : eq(purchaseOrder.number, number),
        )
      : undefined,
  )
  const orders = await tx
    .select({
      id: purchaseOrder.id,
      number: purchaseOrder.number,
      supplierName: purchaseOrder.supplierName,
      status: purchaseOrder.status,
      locationName: location.name,
      expectedAt: purchaseOrder.expectedAt,
      shippingPaise: purchaseOrder.shippingPaise,
      taxPaise: purchaseOrder.taxPaise,
      createdAt: purchaseOrder.createdAt,
    })
    .from(purchaseOrder)
    .innerJoin(location, eq(location.id, purchaseOrder.locationId))
    .where(where)
    .orderBy(desc(purchaseOrder.number))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage)
  const [total] = await tx.select({ n: count() }).from(purchaseOrder).where(where)
  const lines = orders.length
    ? await tx
        .select({
          purchaseOrderId: purchaseOrderLine.purchaseOrderId,
          quantity: purchaseOrderLine.quantity,
          received: purchaseOrderLine.received,
          unitCostPaise: purchaseOrderLine.unitCostPaise,
        })
        .from(purchaseOrderLine)
        .where(
          inArray(
            purchaseOrderLine.purchaseOrderId,
            orders.map((o) => o.id),
          ),
        )
    : []
  return {
    rows: orders.map((o) => ({
      ...o,
      ...purchaseOrderTotals(
        lines.filter((l) => l.purchaseOrderId === o.id),
        o.shippingPaise,
        o.taxPaise,
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
        sql<number>`coalesce(sum(greatest(0, ${purchaseOrderLine.quantity} - ${purchaseOrderLine.received})), 0)`.mapWith(
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
  return {
    ...po,
    lines: lines.map((l) => ({
      ...l,
      productTitle: details.get(l.variantId)?.productTitle ?? '',
      variantTitle: details.get(l.variantId)?.variantTitle ?? '',
      sku: details.get(l.variantId)?.sku ?? null,
      imageUrl: details.get(l.variantId)?.imageUrl ?? null,
    })),
    totals: purchaseOrderTotals(lines, po.shippingPaise, po.taxPaise),
  }
}
