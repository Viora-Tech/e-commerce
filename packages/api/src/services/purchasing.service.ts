import type { InboundShipmentStatus } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  inboundShipment,
  purchaseCharge,
  purchaseOrder,
  purchaseOrderLine,
  supplier,
} from '@commerce/db'
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'

// Services are the only code that runs queries. They receive a store-scoped tx.

type Page = { page: number; perPage: number }

export async function listSuppliers(tx: StoreTx, q: Page & { search?: string | undefined }) {
  const term = q.search?.trim()
  const where = term
    ? or(
        ilike(supplier.name, `%${term}%`),
        ilike(supplier.gstin, `%${term}%`),
        ilike(supplier.email, `%${term}%`),
      )
    : undefined
  const rows = await tx
    .select({
      id: supplier.id,
      name: supplier.name,
      country: supplier.country,
      currency: supplier.currency,
      gstin: supplier.gstin,
      email: supplier.email,
      phone: supplier.phone,
      paymentTerms: supplier.paymentTerms,
    })
    .from(supplier)
    .where(where)
    .orderBy(asc(supplier.name), asc(supplier.id))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage)
  const [total] = await tx.select({ n: count() }).from(supplier).where(where)
  const ids = rows.map((r) => r.id)
  const orders = ids.length
    ? await tx
        .select({ supplierId: purchaseOrder.supplierId, n: count() })
        .from(purchaseOrder)
        .where(inArray(purchaseOrder.supplierId, ids))
        .groupBy(purchaseOrder.supplierId)
    : []
  const ordersOf = new Map(orders.map((o) => [o.supplierId, Number(o.n)]))
  return {
    rows: rows.map((r) => ({ ...r, orders: ordersOf.get(r.id) ?? 0 })),
    total: Number(total?.n ?? 0),
  }
}

export async function getSupplier(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(supplier).where(eq(supplier.id, id))
  if (!row) return null
  const orders = await tx
    .select({
      id: purchaseOrder.id,
      number: purchaseOrder.number,
      status: purchaseOrder.status,
      currency: purchaseOrder.currency,
      createdAt: purchaseOrder.createdAt,
    })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.supplierId, id))
    .orderBy(desc(purchaseOrder.number))
    .limit(20)
  return { ...row, orders }
}

export async function listInboundShipments(
  tx: StoreTx,
  q: Page & {
    status?: InboundShipmentStatus | 'all' | undefined
    search?: string | undefined
  },
) {
  const term = q.search?.trim()
  const where = and(
    q.status && q.status !== 'all' ? eq(inboundShipment.status, q.status) : undefined,
    term
      ? or(
          ilike(inboundShipment.reference, `%${term}%`),
          ilike(inboundShipment.billOfEntryNo, `%${term}%`),
          ilike(inboundShipment.port, `%${term}%`),
        )
      : undefined,
  )
  const rows = await tx
    .select({
      id: inboundShipment.id,
      number: inboundShipment.number,
      reference: inboundShipment.reference,
      billOfEntryNo: inboundShipment.billOfEntryNo,
      port: inboundShipment.port,
      status: inboundShipment.status,
      arrivedAt: inboundShipment.arrivedAt,
      createdAt: inboundShipment.createdAt,
    })
    .from(inboundShipment)
    .where(where)
    .orderBy(desc(inboundShipment.number))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage)
  const [total] = await tx.select({ n: count() }).from(inboundShipment).where(where)
  const ids = rows.map((r) => r.id)
  const orders = ids.length
    ? await tx
        .select({ shipmentId: purchaseOrder.inboundShipmentId, n: count() })
        .from(purchaseOrder)
        .where(inArray(purchaseOrder.inboundShipmentId, ids))
        .groupBy(purchaseOrder.inboundShipmentId)
    : []
  const charges = ids.length
    ? await tx
        .select({ shipmentId: purchaseCharge.inboundShipmentId, n: count() })
        .from(purchaseCharge)
        .where(inArray(purchaseCharge.inboundShipmentId, ids))
        .groupBy(purchaseCharge.inboundShipmentId)
    : []
  const ordersOf = new Map(orders.map((o) => [o.shipmentId, Number(o.n)]))
  const chargesOf = new Map(charges.map((c) => [c.shipmentId, Number(c.n)]))
  return {
    rows: rows.map((r) => ({
      ...r,
      orders: ordersOf.get(r.id) ?? 0,
      charges: chargesOf.get(r.id) ?? 0,
    })),
    total: Number(total?.n ?? 0),
  }
}

export async function getInboundShipment(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(inboundShipment).where(eq(inboundShipment.id, id))
  if (!row) return null
  const orders = await tx
    .select({
      id: purchaseOrder.id,
      number: purchaseOrder.number,
      supplierName: purchaseOrder.supplierName,
      status: purchaseOrder.status,
      currency: purchaseOrder.currency,
    })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.inboundShipmentId, id))
    .orderBy(asc(purchaseOrder.number))
  const units = orders.length
    ? await tx
        .select({
          purchaseOrderId: purchaseOrderLine.purchaseOrderId,
          n: sql<number>`coalesce(sum(${purchaseOrderLine.quantity}), 0)`.mapWith(Number),
        })
        .from(purchaseOrderLine)
        .where(
          inArray(
            purchaseOrderLine.purchaseOrderId,
            orders.map((o) => o.id),
          ),
        )
        .groupBy(purchaseOrderLine.purchaseOrderId)
    : []
  const unitsOf = new Map(units.map((u) => [u.purchaseOrderId, u.n]))
  return { ...row, orders: orders.map((o) => ({ ...o, units: unitsOf.get(o.id) ?? 0 })) }
}
