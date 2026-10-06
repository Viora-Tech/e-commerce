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

/** Store ids with review requests or reminders to send (Reviews app), for the worker. SECURITY DEFINER backed. */
export async function storesWithDueReviewRequests(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_due_review_requests() as id`)
  return rows.map((r) => r.id)
}

/** Store ids whose sender email domain is pending, or verified but due its daily re-check. SECURITY DEFINER backed. */
export async function storesWithSenderEmailChecks(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_sender_email_checks() as id`)
  return rows.map((r) => r.id)
}
