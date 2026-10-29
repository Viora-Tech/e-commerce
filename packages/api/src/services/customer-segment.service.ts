import { evaluateSegment, type SegmentCustomer } from '@commerce/core'
import type { CustomerSegmentRules, StoreTx } from '@commerce/db'
import { customerSegment } from '@commerce/db'
import { asc, eq } from 'drizzle-orm'
import { type CustomerListItem, listAllCustomers } from './customer.service'

/* Saved customer segments: rule sets evaluated over the customer list. */

function toSegmentCustomer(item: CustomerListItem): SegmentCustomer {
  return {
    spentPaise: item.spentPaise,
    orderCount: item.orderCount,
    stateCode: item.stateCode,
    tags: item.tags,
    lastOrderAt: item.lastOrderAt,
    acceptsMarketing: item.acceptsMarketing,
    hasGstin: item.hasGstin,
  }
}

export async function listSegments(tx: StoreTx, secret: string, now = new Date()) {
  const [segments, everyone] = await Promise.all([
    tx.select().from(customerSegment).orderBy(asc(customerSegment.name)),
    listAllCustomers(tx, {}, secret, now),
  ])
  return segments.map((s) => ({
    ...s,
    customerCount: everyone.filter((cu) => evaluateSegment(toSegmentCustomer(cu), s.rules, now))
      .length,
  }))
}

export async function getSegment(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(customerSegment).where(eq(customerSegment.id, id))
  return row ?? null
}

export async function saveSegment(
  tx: StoreTx,
  input: { id?: string | undefined; name: string; rules: CustomerSegmentRules; storeId: string },
) {
  if (input.id) {
    const [row] = await tx
      .update(customerSegment)
      .set({ name: input.name, rules: input.rules, updatedAt: new Date() })
      .where(eq(customerSegment.id, input.id))
      .returning()
    return row ?? null
  }
  const [row] = await tx
    .insert(customerSegment)
    .values({ storeId: input.storeId, name: input.name, rules: input.rules })
    .returning()
  return row ?? null
}

export async function deleteSegment(tx: StoreTx, id: string) {
  await tx.delete(customerSegment).where(eq(customerSegment.id, id))
}

/** Customers matching a rule set; drives the builder preview and the segment page. */
export async function listSegmentCustomers(
  tx: StoreTx,
  rules: CustomerSegmentRules,
  secret: string,
  now = new Date(),
) {
  const everyone = await listAllCustomers(tx, {}, secret, now)
  return everyone.filter((cu) => evaluateSegment(toSegmentCustomer(cu), rules, now))
}
