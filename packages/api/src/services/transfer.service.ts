import type { StoreTx } from '@commerce/db'
import { location, transfer, transferLine } from '@commerce/db'
import {
  aliasedTable,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
} from 'drizzle-orm'
import { lineDetails } from './purchase-order.service'

// Services are the only code that runs queries. They receive a store-scoped tx.

type TransferStatus = 'draft' | 'in_transit' | 'received'

/** The list's filter panel; arrays are "any of", each part combines with the tab and search. */
export type TransferListFilters = {
  statuses?: TransferStatus[] | undefined
  fromLocationIds?: string[] | undefined
  toLocationIds?: string[] | undefined
  /** Created in [from, to); ISO times. */
  createdFrom?: string | undefined
  createdTo?: string | undefined
  /** Received in [from, to); ISO times. */
  receivedFrom?: string | undefined
  receivedTo?: string | undefined
}

function transferFiltersWhere(f: TransferListFilters) {
  return and(
    f.statuses?.length ? inArray(transfer.status, f.statuses) : undefined,
    f.fromLocationIds?.length ? inArray(transfer.fromLocationId, f.fromLocationIds) : undefined,
    f.toLocationIds?.length ? inArray(transfer.toLocationId, f.toLocationIds) : undefined,
    f.createdFrom ? gte(transfer.createdAt, new Date(f.createdFrom)) : undefined,
    f.createdTo ? lt(transfer.createdAt, new Date(f.createdTo)) : undefined,
    f.receivedFrom ? gte(transfer.receivedAt, new Date(f.receivedFrom)) : undefined,
    f.receivedTo ? lt(transfer.receivedAt, new Date(f.receivedTo)) : undefined,
  )
}

export async function listTransfers(
  tx: StoreTx,
  q: {
    status?: 'all' | TransferStatus | undefined
    search?: string | undefined
    page: number
    perPage: number
  } & TransferListFilters,
) {
  const from = aliasedTable(location, 'from_location')
  const to = aliasedTable(location, 'to_location')
  const term = q.search?.trim()
  const where = and(
    q.status && q.status !== 'all' ? eq(transfer.status, q.status) : undefined,
    term
      ? or(
          ilike(from.name, `%${term}%`),
          ilike(to.name, `%${term}%`),
          sql`${transfer.number}::text = ${term.replace(/^#?T?/i, '')}`,
        )
      : undefined,
    transferFiltersWhere(q),
  )
  const rows = await tx
    .select({
      id: transfer.id,
      number: transfer.number,
      status: transfer.status,
      fromName: from.name,
      toName: to.name,
      createdAt: transfer.createdAt,
      shippedAt: transfer.shippedAt,
      receivedAt: transfer.receivedAt,
      units:
        sql<number>`(select coalesce(sum(${transferLine.quantity}), 0) from ${transferLine} where ${transferLine.transferId} = ${transfer.id})`.mapWith(
          Number,
        ),
    })
    .from(transfer)
    .innerJoin(from, eq(from.id, transfer.fromLocationId))
    .innerJoin(to, eq(to.id, transfer.toLocationId))
    .where(where)
    .orderBy(desc(transfer.number))
    .limit(q.perPage)
    .offset((q.page - 1) * q.perPage)
  const [total] = await tx
    .select({ n: count() })
    .from(transfer)
    .innerJoin(from, eq(from.id, transfer.fromLocationId))
    .innerJoin(to, eq(to.id, transfer.toLocationId))
    .where(where)
  return { rows, total: Number(total?.n ?? 0) }
}

export async function getTransfer(tx: StoreTx, id: string) {
  const [t] = await tx.select().from(transfer).where(eq(transfer.id, id))
  if (!t) return null
  const lines = await tx
    .select()
    .from(transferLine)
    .where(eq(transferLine.transferId, id))
    .orderBy(asc(transferLine.id))
  const details = await lineDetails(
    tx,
    lines.map((l) => l.variantId),
  )
  return {
    ...t,
    lines: lines.map((l) => ({
      ...l,
      productTitle: details.get(l.variantId)?.productTitle ?? '',
      variantTitle: details.get(l.variantId)?.variantTitle ?? '',
      sku: details.get(l.variantId)?.sku ?? null,
      imageUrl: details.get(l.variantId)?.imageUrl ?? null,
    })),
  }
}
