import { sql } from 'drizzle-orm'
import type { Db } from './client'

/**
 * Map a hostname to a store id before any store context exists. Backed by the
 * SECURITY DEFINER function `resolve_store`, so the app role can call it even
 * though `store_domain` is RLS-protected. Returns null for unknown hosts.
 */
export async function resolveStore(db: Db, hostname: string): Promise<string | null> {
  const [row] = await db.execute<{ id: string | null }>(
    sql`select resolve_store(${hostname.toLowerCase()}) as id`,
  )
  return row?.id ?? null
}

/**
 * Whether a store slug is already in use, before any store context exists
 * (picking a store address in onboarding). Backed by the SECURITY DEFINER
 * function `store_slug_taken`, so the app role can check even though `store`
 * itself is RLS-protected by id.
 */
export async function isStoreSlugTaken(db: Db, slug: string): Promise<boolean> {
  const [row] = await db.execute<{ taken: boolean | null }>(
    sql`select store_slug_taken(${slug.toLowerCase()}) as taken`,
  )
  return row?.taken ?? false
}

/** Organization id -> store id, via the SECURITY DEFINER function. Null if none. */
export async function resolveStoreForOrganization(
  db: Db,
  organizationId: string,
): Promise<string | null> {
  const [row] = await db.execute<{ id: string | null }>(
    sql`select resolve_store_for_organization(${organizationId}) as id`,
  )
  return row?.id ?? null
}

/**
 * A member's role in an organization and that organization's store id, in one round trip: the
 * admin API's membership check before every store call. Null when the user is not a member of
 * the organization; `storeId` is null when the organization has no store.
 */
export async function organizationMembership(
  db: Db,
  organizationId: string,
  userId: string,
): Promise<{ role: string; storeId: string | null } | null> {
  const [row] = await db.execute<{ role: string; store_id: string | null }>(
    sql`select m.role, resolve_store_for_organization(${organizationId}) as store_id
        from member m
        where m.organization_id = ${organizationId} and m.user_id = ${userId}
        limit 1`,
  )
  return row ? { role: row.role, storeId: row.store_id } : null
}

/** Store ids with parcels still moving, for the worker's tracking job. SECURITY DEFINER backed. */
export async function storesWithOpenShipments(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_open_shipments() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with placed online-payment orders, for the unpaid-order expiry job. SECURITY DEFINER backed. */
export async function storesWithUnpaidOnlineOrders(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_unpaid_online_orders() as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids with placed manual UPI / bank transfer orders, for the follow-up job. SECURITY DEFINER backed. */
export async function storesWithPendingManualOrders(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_pending_manual_orders() as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids with a pre-order balance still owed, for the balance job. SECURITY DEFINER backed. */
export async function storesWithBalanceDue(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_balance_due() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with undispatched outbox rows, for the outbox relay. SECURITY DEFINER backed. */
export async function storesWithUndispatchedOutboxEvents(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_undispatched_outbox_events() as id`,
  )
  return rows.map((r) => r.id)
}

/**
 * Store ids with marketing work for the worker's tick: an active automation,
 * a campaign due to send or still sending, or an automation run that is due.
 * SECURITY DEFINER backed; returns ids only.
 */
export async function storesWithMarketingWork(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_marketing_work() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with automation work due (waits, retries, lost runs, approvals, schedules). SECURITY DEFINER backed. */
export async function storesWithAutomationWork(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_automation_work() as id`)
  return rows.map((r) => r.id)
}

/**
 * Store ids with automation step detail or finished runs past retention, for the daily prune.
 * SECURITY DEFINER backed (`stores_with_old_automation_runs`, migration 0154_automations).
 */
export async function storesWithOldAutomationRuns(db: Db, now = new Date()): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_old_automation_runs(${now.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}

/**
 * Store ids with Pixels log or day rows past 30 days, or orders whose tracking IP/UA is due to
 * be cleared, for the daily `{pixels}-prune`. SECURITY DEFINER backed (`stores_with_old_pixel_data`,
 * migration 0160_pixels).
 */
export async function storesWithOldPixelData(db: Db, now = new Date()): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_old_pixel_data(${now.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids with baskets worth a recovery nudge, for the worker. SECURITY DEFINER backed. */
export async function storesWithAbandonedCarts(db: Db, cutoff: Date): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_abandoned_carts(${cutoff}) as id`,
  )
  return rows.map((r) => r.id)
}

/**
 * Store ids with a Shopify import preview snapshot older than `cutoff`, for the
 * worker's snapshot cleanup. SECURITY DEFINER backed.
 */
export async function storesWithStaleImportSnapshots(db: Db, cutoff: Date): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_stale_import_snapshots(${cutoff.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}

/** How the storefront should answer a hostname: which store, and whether to send it elsewhere. */
export type HostRoute = {
  storeId: string
  /** The store's live primary hostname; null when it has none. */
  primaryHostname: string | null
  /** True when this host is not the primary and should 301 to it. */
  redirect: boolean
}

/**
 * Hostname → routing answer before any store context exists, via the SECURITY
 * DEFINER function `resolve_host`. Only live (`active`) domains resolve.
 */
export async function resolveHost(db: Db, hostname: string): Promise<HostRoute | null> {
  const [row] = await db.execute<{
    store_id: string | null
    primary_hostname: string | null
    redirect: boolean | null
  }>(sql`select * from resolve_host(${hostname.toLowerCase()})`)
  if (!row?.store_id) return null
  return {
    storeId: row.store_id,
    primaryHostname: row.primary_hostname,
    redirect: row.redirect === true,
  }
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

/** The store and grant an access token belongs to, before any store context exists. Null when no live grant has it. */
export async function apiGrantForAccess(
  db: Db,
  hash: string,
): Promise<{ storeId: string; grantId: string } | null> {
  const [row] = await db.execute<{ store_id: string; grant_id: string }>(
    sql`select store_id, grant_id from api_grant_for_access(${hash})`,
  )
  return row ? { storeId: row.store_id, grantId: row.grant_id } : null
}

/** The same for an OAuth refresh token. */
export async function apiGrantForRefresh(
  db: Db,
  hash: string,
): Promise<{ storeId: string; grantId: string } | null> {
  const [row] = await db.execute<{ store_id: string; grant_id: string }>(
    sql`select store_id, grant_id from api_grant_for_refresh(${hash})`,
  )
  return row ? { storeId: row.store_id, grantId: row.grant_id } : null
}

/** The store a one-time OAuth sign-in code was issued for. */
export async function apiAuthCodeStore(db: Db, hash: string): Promise<string | null> {
  const [row] = await db.execute<{ id: string | null }>(
    sql`select api_auth_code_store(${hash}) as id`,
  )
  return row?.id ?? null
}

/** The store a slug names (the MCP address), before any store context exists. */
export async function storeIdForSlug(db: Db, slug: string): Promise<string | null> {
  const [row] = await db.execute<{ id: string | null }>(
    sql`select store_id_for_slug(${slug.toLowerCase()}) as id`,
  )
  return row?.id ?? null
}

/** Stores whose MCP & API activity log has rows past the 90 days it keeps. */
export async function storesWithOldApiActivity(db: Db, now = new Date()): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_old_api_activity(${now.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}

/** Stores with a Meta, Google or OpenAI channel connection, for the catalog sync sweep. */
export async function storesWithChannelConnections(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_channel_connections() as id`)
  return rows.map((r) => r.id)
}

/**
 * The stores behind an outside platform's account (a Facebook user id, a WhatsApp Business
 * account id, a `shop.myshopify.com` domain), for callbacks that name no store.
 */
export async function storesForPlatformAccount(
  db: Db,
  platform: 'meta' | 'whatsapp' | 'shopify',
  externalId: string,
): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_for_platform_account(${platform}, ${externalId}) as id`,
  )
  return rows.map((r) => r.id)
}
