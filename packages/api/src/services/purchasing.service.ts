import type { InboundShipmentStatus } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  inboundShipment,
  purchaseCharge,
  purchaseOrder,
  purchaseOrderLine,
  supplier,
} from '@commerce/db'
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm'

// Services are the only code that runs queries. They receive a store-scoped tx.

type Page = { page: number; perPage: number }

/** The Suppliers filter panel; arrays are "any of", each part combines with search. */
export type SupplierListFilters = {
  countries?: string[] | undefined
  currencies?: string[] | undefined
  hasGstin?: boolean | undefined
  /** Has at least one purchase order (true) or none (false). */
  hasOrders?: boolean | undefined
}

/* The outer column is named in full: drizzle prints it bare in a one-table select, and a bare
   `id` would bind to the subquery's own table. */
const supplierHasOrders = sql`exists (select 1 from ${purchaseOrder} po where po.supplier_id = "supplier"."id")`

function supplierFiltersWhere(f: SupplierListFilters) {
  const hasGstin = sql`coalesce(${supplier.gstin}, '') <> ''`
  return and(
    f.countries?.length ? inArray(supplier.country, f.countries) : undefined,
    f.currencies?.length ? inArray(supplier.currency, f.currencies) : undefined,
    f.hasGstin === undefined ? undefined : f.hasGstin ? hasGstin : sql`not ${hasGstin}`,
    f.hasOrders === undefined
      ? undefined
      : f.hasOrders
        ? supplierHasOrders
        : sql`not ${supplierHasOrders}`,
  )
}

/** The countries and currencies suppliers use, for the list's filter pickers. */
export async function supplierFacets(tx: StoreTx) {
  const [countries, currencies] = await Promise.all([
    tx.selectDistinct({ v: supplier.country }).from(supplier).orderBy(asc(supplier.country)),
    tx.selectDistinct({ v: supplier.currency }).from(supplier).orderBy(asc(supplier.currency)),
  ])
  return { countries: countries.map((r) => r.v), currencies: currencies.map((r) => r.v) }
}

export async function listSuppliers(
  tx: StoreTx,
  q: Page & { search?: string | undefined } & SupplierListFilters,
) {
  const term = q.search?.trim()
  const where = and(
    term
      ? or(
          ilike(supplier.name, `%${term}%`),
          ilike(supplier.gstin, `%${term}%`),
          ilike(supplier.email, `%${term}%`),
        )
      : undefined,
    supplierFiltersWhere(q),
  )
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
      address: supplier.address,
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

/** The Inbound shipments filter panel; arrays are "any of", each part combines with the others. */
export type InboundShipmentListFilters = {
  statuses?: InboundShipmentStatus[] | undefined
  /** Expected in [from, to); ISO times. The expected day starts at midnight India time. */
  expectedFrom?: string | undefined
  expectedTo?: string | undefined
  /** Arrived in [from, to); ISO times. */
  arrivedFrom?: string | undefined
  arrivedTo?: string | undefined
  hasBillOfEntry?: boolean | undefined
}

function inboundFiltersWhere(f: InboundShipmentListFilters) {
  const expectedDay = sql`(${inboundShipment.expectedAt}::timestamp at time zone 'Asia/Kolkata')`
  const hasBoe = sql`coalesce(${inboundShipment.billOfEntryNo}, '') <> ''`
  return and(
    f.statuses?.length ? inArray(inboundShipment.status, f.statuses) : undefined,
    f.expectedFrom ? sql`${expectedDay} >= ${f.expectedFrom}::timestamptz` : undefined,
    f.expectedTo ? sql`${expectedDay} < ${f.expectedTo}::timestamptz` : undefined,
    f.arrivedFrom ? gte(inboundShipment.arrivedAt, new Date(f.arrivedFrom)) : undefined,
    f.arrivedTo ? lt(inboundShipment.arrivedAt, new Date(f.arrivedTo)) : undefined,
    f.hasBillOfEntry === undefined ? undefined : f.hasBillOfEntry ? hasBoe : sql`not ${hasBoe}`,
  )
}

export async function listInboundShipments(
  tx: StoreTx,
  q: Page & {
    status?: InboundShipmentStatus | 'all' | undefined
    search?: string | undefined
  } & InboundShipmentListFilters,
) {
  const term = q.search?.trim()
  const where = and(
    q.status && q.status !== 'all' ? eq(inboundShipment.status, q.status) : undefined,
    inboundFiltersWhere(q),
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
