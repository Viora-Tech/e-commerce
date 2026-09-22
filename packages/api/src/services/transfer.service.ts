import type { StoreTx } from '@commerce/db'
import { location, transfer, transferLine } from '@commerce/db'
import { aliasedTable, asc, count, desc, eq, sql } from 'drizzle-orm'
import { lineDetails } from './purchase-order.service'

// Services are the only code that runs queries. They receive a store-scoped tx.

export async function listTransfers(
  tx: StoreTx,
  q: {
    status?: 'all' | 'draft' | 'in_transit' | 'received' | undefined
    page: number
    perPage: number
  },
) {
  const from = aliasedTable(location, 'from_location')
  const to = aliasedTable(location, 'to_location')
  const where = q.status && q.status !== 'all' ? eq(transfer.status, q.status) : undefined
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
  const [total] = await tx.select({ n: count() }).from(transfer).where(where)
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
