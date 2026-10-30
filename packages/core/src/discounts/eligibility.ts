/** SOURCE OF TRUTH: discount customer eligibility lookup — WHAT: who the shopper is (customer id by email) and which of the discounts' segments they are in, and whether they ordered before (first-time buyers) / WHY: Shopify's "Customer eligibility" (specific segments or customers); the pure evaluator only compares ids, this reads them */
import { customer, customerSegment, order, type StoreTx } from '@commerce/db'
import { and, eq, inArray, ne, notInArray, or, type SQL, sql } from 'drizzle-orm'
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

/**
 * The spellings an order may hold a phone in, for "first-time buyers only". Checkout stores an
 * Indian mobile as ten digits; imports and older rows carry 91, +91 or a leading 0. A number
 * abroad is kept in E.164 (`+61…`), so only that and its bare digits are tried: its last ten
 * digits are not an Indian mobile.
 */
export function orderPhoneForms(raw: string | null | undefined): string[] {
  const text = raw?.trim() ?? ''
  const digits = text.replace(/\D/g, '')
  if (digits.length < 7) return []
  const abroad = text.startsWith('+') && !text.startsWith('+91')
  if (abroad) return [...new Set([`+${digits}`, digits])]
  const local = digits.slice(-10)
  return [...new Set([local, `91${local}`, `+91${local}`, `+91 ${local}`, `0${local}`])]
}

/**
 * "First-time buyers only": true when nobody with this email (or its customer) or phone has a
 * paid order yet, false when someone has, undefined when no rule asks or the shopper is not
 * known yet (the cart page). Drafts, cancelled and test orders never count; neither does an
 * order still unpaid (a COD parcel on its way), as the rule is about an earlier paid order.
 */
export async function firstOrderFor(
  tx: StoreTx,
  shopper: { email?: string | null | undefined; phone?: string | null | undefined },
  rules: DiscountRule[],
): Promise<boolean | undefined> {
  if (!rules.some((r) => r.customerEligibility === 'first_time')) return undefined
  const email = shopper.email?.trim().toLowerCase() || null
  const phones = orderPhoneForms(shopper.phone)
  if (!email && phones.length === 0) return undefined
  const who: SQL[] = []
  if (email) {
    who.push(sql`lower(${order.email}) = ${email}`)
    who.push(
      sql`${order.customerId} in (select ${customer.id} from ${customer} where lower(${customer.email}) = ${email})`,
    )
  }
  if (phones.length > 0) who.push(inArray(order.phone, phones))
  const [row] = await tx
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        notInArray(order.status, ['draft', 'cancelled']),
        eq(order.isTest, false),
        ne(order.paymentStatus, 'unpaid'),
        or(...who),
      ),
    )
    .limit(1)
  return !row
}
