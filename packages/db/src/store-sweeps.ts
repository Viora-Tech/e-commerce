/** SOURCE OF TRUTH: storesWith* sweep lookups — WHAT: which stores a worker job must visit (retention, rollouts, domains, certificates, search console, reviews, sender email, payment fees, pending gateway refunds) via SECURITY DEFINER functions / WHY: split from resolve-store.ts to stay under the 500-line cap */
import { sql } from 'drizzle-orm'
import type { Db } from './client'

/**
 * Store ids with carts or logs past retention (old carts, dispatched outbox rows, old webhook
 * payloads), for the worker's daily prune. SECURITY DEFINER backed (`stores_with_retention_due`, 0177).
 */
export async function storesWithRetentionDue(db: Db, at: Date): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_retention_due(${at.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}

/**
 * Store ids with a rollout due: scheduled and its start reached, or an active event past its end,
 * for the worker's tick. SECURITY DEFINER backed (`stores_with_rollouts_due`, 0184).
 */
export async function storesWithRolloutsDue(db: Db, at: Date): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_rollouts_due(${at.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids with custom domains awaiting DNS or a certificate, for the worker. SECURITY DEFINER backed. */
export async function storesWithPendingDomains(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_pending_domains() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with a store address (platform domain) whose route was never asked for, for the worker. SECURITY DEFINER backed. */
export async function storesWithUnroutedPlatformDomains(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_unrouted_platform_domains() as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids with a domain whose certificate needs checking or retrying, for the worker. SECURITY DEFINER backed. */
export async function storesWithCertificateChecks(db: Db, now = new Date()): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_certificate_checks(${now.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}

/**
 * Store ids with the Google Search Console app installed and connected to a property, whose
 * last sync attempt is over 20 hours old (or never ran), for the worker's daily sync.
 * SECURITY DEFINER backed.
 */
export async function storesWithSearchConsoleDue(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_search_console_due() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with affiliate commissions whose hold is over (Affiliates app), for the worker. SECURITY DEFINER backed. */
export async function storesWithDueAffiliateCommissions(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_due_affiliate_commissions() as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids with review requests or reminders to send (Reviews app), for the worker. SECURITY DEFINER backed. */
export async function storesWithDueReviewRequests(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_due_review_requests() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with an AI review summary to (re)write (Reviews app), for the worker. SECURITY DEFINER backed. */
export async function storesWithStaleReviewSummaries(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_stale_review_summaries() as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids where a member asked for a daily summary (Account → Notifications). SECURITY DEFINER backed. */
export async function storesWithMemberDailySummaries(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_member_daily_summaries() as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids whose sender email domain is pending, or verified but due its daily re-check. SECURITY DEFINER backed. */
export async function storesWithSenderEmailChecks(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_sender_email_checks() as id`)
  return rows.map((r) => r.id)
}

/**
 * Store ids with a recent Razorpay or Cashfree capture whose fee is not known yet and was not
 * asked about in the last 6 hours, for the worker's fee sync. SECURITY DEFINER backed.
 */
export async function storesWithUnknownPaymentFees(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_unknown_payment_fees() as id`,
  )
  return rows.map((r) => r.id)
}

/**
 * Store ids with a gateway refund still pending on a gateway without refund webhooks
 * (Decentro), for the worker's refund sync. SECURITY DEFINER backed (0241).
 */
export async function storesWithPendingGatewayRefunds(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_pending_gateway_refunds() as id`,
  )
  return rows.map((r) => r.id)
}
