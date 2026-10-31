import { customer, customerSegment, type StoreTx } from '@commerce/db'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { evaluateSegment, type SegmentRules } from '../customers/segments'
import { customerSpentSql } from '../customers/spent'

export type AudienceMember = {
  customerId: string
  name: string | null
  /** Email for email campaigns, E.164 digits for WhatsApp. */
  to: string
}

export type AudienceKind = 'email' | 'whatsapp'

/*
 * Written against the aliases in the from clause; see the note in
 * cart/abandoned.ts about interpolated columns in projection subqueries.
 */
const orderCount = sql<number>`(select count(*)::int from "order" o where o.customer_id = customer.id and o.status not in ('draft', 'cancelled') and not o.is_test)`
/* Paid and kept, not every order's total (audit #132). */
const spent = customerSpentSql(sql`${customer.id}`)
const lastOrder = sql<
  string | null
>`(select max(o.placed_at) from "order" o where o.customer_id = customer.id and o.status not in ('draft', 'cancelled') and not o.is_test)`

/** Indian mobile numbers without a country code gain 91; anything else keeps its digits. */
export function normalisePhone(raw: string | null | undefined): string | null {
  const digits = raw?.replace(/\D/g, '') ?? ''
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits.length >= 11 && digits.length <= 15 ? digits : null
}

/**
 * Customers a campaign may reach: those in the segment (every customer when
 * there is none) who consented to this channel and never unsubscribed.
 * Deduplicated by address, because two customer rows can share a phone.
 */
export async function campaignAudience(
  tx: StoreTx,
  input: { kind: AudienceKind; segmentId: string | null; now?: Date | undefined },
  secret: string,
): Promise<AudienceMember[]> {
  let rules: SegmentRules | null = null
  if (input.segmentId) {
    const [seg] = await tx
      .select({ rules: customerSegment.rules })
      .from(customerSegment)
      .where(eq(customerSegment.id, input.segmentId))
    if (!seg) return []
    rules = seg.rules as SegmentRules
  }
  const consent =
    input.kind === 'email'
      ? and(eq(customer.acceptsMarketing, true), sql`${customer.email} is not null`)
      : and(eq(customer.acceptsWhatsapp, true), sql`${customer.phone} is not null`)
  const rows = await tx
    .select({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      tags: customer.tags,
      acceptsMarketing: customer.acceptsMarketing,
      stateCode: sql<string | null>`${customer.defaultAddress} ->> 'stateCode'`,
      hasGstin: sql<boolean>`coalesce(btrim(${customer.gstin}), '') <> ''`,
      orderCount,
      spent,
      lastOrder,
    })
    .from(customer)
    .where(and(consent, isNull(customer.unsubscribedAt)))
  const now = input.now ?? new Date()
  const seen = new Set<string>()
  const out: AudienceMember[] = []
  for (const r of rows) {
    if (
      rules &&
      !evaluateSegment(
        {
          spentPaise: r.spent,
          orderCount: r.orderCount,
          stateCode: r.stateCode,
          tags: r.tags,
          lastOrderAt: r.lastOrder,
          acceptsMarketing: r.acceptsMarketing,
          hasGstin: r.hasGstin,
        },
        rules,
        now,
      )
    ) {
      continue
    }
    const to =
      input.kind === 'email'
        ? r.email?.trim().toLowerCase()
        : normalisePhone(decryptCustomerPhone(r.phone, secret))
    if (!to || seen.has(to)) continue
    seen.add(to)
    out.push({ customerId: r.id, name: r.name, to })
  }
  return out
}
