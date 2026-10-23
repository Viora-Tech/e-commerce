/** SOURCE OF TRUTH: discount customer eligibility lookup — WHAT: who the shopper is (customer id by email) and which of the discounts' segments they are in / WHY: Shopify's "Customer eligibility" (specific segments or customers); the pure evaluator only compares ids, this reads them */
import { customer, customerSegment, type StoreTx } from '@commerce/db'
import { inArray, sql } from 'drizzle-orm'
import { evaluateSegment, type SegmentRules } from '../customers/segments'
import type { DiscountContext, DiscountRule } from './evaluate'

/* Same figures segments are built on (marketing/audience.ts). */
const orderCount = sql<number>`(select count(*)::int from "order" o where o.customer_id = customer.id and o.status not in ('draft', 'cancelled') and not o.is_test)`
const spent = sql<number>`(select coalesce(sum(o.total_paise), 0)::int from "order" o where o.customer_id = customer.id and o.status not in ('draft', 'cancelled') and not o.is_test)`
const lastOrder = sql<
  string | null
>`(select max(o.placed_at) from "order" o where o.customer_id = customer.id and o.status not in ('draft', 'cancelled') and not o.is_test)`

/**
 * The shopper as the evaluator wants them, or undefined when there is no email yet (the
 * cart page): eligibility then waits for checkout. Segments are only evaluated when one of
 * the rules is limited to segments, so ordinary carts pay nothing for this.
 */
export async function shopperFor(
  tx: StoreTx,
  email: string | null | undefined,
  rules: DiscountRule[],
  now: Date = new Date(),
): Promise<DiscountContext['customer']> {
  const address = email?.trim().toLowerCase()
  if (!address) return undefined
  const limited = rules.filter((r) => (r.customerEligibility ?? 'all') !== 'all')
  if (limited.length === 0) return { id: null, segmentIds: [] }
  const [row] = await tx
    .select({
      id: customer.id,
      tags: customer.tags,
      acceptsMarketing: customer.acceptsMarketing,
      stateCode: sql<string | null>`${customer.defaultAddress} ->> 'stateCode'`,
      hasGstin: sql<boolean>`coalesce(btrim(${customer.gstin}), '') <> ''`,
      orderCount,
      spent,
      lastOrder,
    })
    .from(customer)
    .where(sql`lower(${customer.email}) = ${address}`)
    .limit(1)
  if (!row) return { id: null, segmentIds: [] }
  const segmentIds = [
    ...new Set(
      limited
        .filter((r) => r.customerEligibility === 'segments')
        .flatMap((r) => r.eligibleIds ?? []),
    ),
  ]
  if (segmentIds.length === 0) return { id: row.id, segmentIds: [] }
  const segments = await tx
    .select({ id: customerSegment.id, rules: customerSegment.rules })
    .from(customerSegment)
    .where(inArray(customerSegment.id, segmentIds))
  const facts = {
    spentPaise: row.spent,
    orderCount: row.orderCount,
    stateCode: row.stateCode,
    tags: row.tags,
    lastOrderAt: row.lastOrder,
    acceptsMarketing: row.acceptsMarketing,
    hasGstin: row.hasGstin,
  }
  return {
    id: row.id,
    segmentIds: segments
      .filter((s) => evaluateSegment(facts, s.rules as SegmentRules, now))
      .map((s) => s.id),
  }
}
