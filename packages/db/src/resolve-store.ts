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

/** Store ids with Shiprocket or RapidShyp enabled, for the order push job. SECURITY DEFINER backed. */
export async function storesWithOrderPushCouriers(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_order_push_couriers() as id`)
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

/** Store ids with COD orders still waiting for the shopper's confirmation (COD & RTO app). SECURITY DEFINER backed. */
export async function storesWithPendingCodChecks(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_pending_cod_checks() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with a COD "Ask to pay online" still waiting for its reminder. SECURITY DEFINER backed. */
export async function storesWithPayOnlineRequests(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_pay_online_requests() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with a pre-order balance still owed, for the balance job. SECURITY DEFINER backed. */
export async function storesWithBalanceDue(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_balance_due() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with store credit past its expiry and not yet taken off, for the expiry sweep. SECURITY DEFINER backed. */
export async function storesWithStoreCreditExpiring(db: Db, now: Date): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_store_credit_expiring(${now.toISOString()}::timestamptz) as id`,
  )
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

/** One market as the storefront proxy routes it (`store_markets`, 0177). */
export type StoreMarketRoute = {
  id: string
  handle: string
  isPrimary: boolean
  enabled: boolean
  /** ISO 4217. */
  currency: string
  /** Default language (`en`). */
  locale: string
  /** Other languages offered. */
  locales: string[]
  /** URL prefix (`ae`, `en-us`); null for the primary market and domain-only markets. */
  subfolder: string | null
  /** A live domain only this market answers on; null when it has none. */
  hostname: string | null
  /** ISO 3166-1 countries in the market. */
  countries: string[]
}

/**
 * A store's markets with their countries and dedicated domain, before any store context exists
 * (the storefront proxy), via the SECURITY DEFINER function `store_markets`.
 */
export async function storeMarkets(db: Db, storeId: string): Promise<StoreMarketRoute[]> {
  const rows = await db.execute<{
    id: string
    handle: string
    is_primary: boolean
    enabled: boolean
    currency: string
    locale: string
    locales: string[] | null
    subfolder: string | null
    hostname: string | null
    countries: string[] | null
  }>(sql`select * from store_markets(${storeId}::uuid)`)
  return rows.map((r) => ({
    id: r.id,
    handle: r.handle,
    isPrimary: r.is_primary,
    enabled: r.enabled,
    currency: r.currency,
    locale: r.locale,
    locales: r.locales ?? [],
    subfolder: r.subfolder,
    hostname: r.hostname,
    countries: r.countries ?? [],
  }))
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

/** Stores whose activity log (Settings → Activity log) has rows past the year it keeps. */
export async function storesWithOldStoreActivity(db: Db, now = new Date()): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_old_store_activity(${now.toISOString()}::timestamptz) as id`,
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

/** Stores holding a report filed as this GitHub issue, for the GitHub webhook. SECURITY DEFINER backed. */
export async function bugReportStoresForIssue(db: Db, issueNumber: number): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select bug_report_stores_for_issue(${issueNumber}::int) as id`,
  )
  return rows.map((r) => r.id)
}

/** Stores with a Shopify connection, for the token sweep. SECURITY DEFINER backed. */
export async function storesWithShopifyConnections(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_shopify_connections() as id`)
  return rows.map((r) => r.id)
}

/**
 * Stores with bug reports: all of them (the platform console), or with `openOnly` those whose
 * GitHub issue may still change (the worker's poll, the "live" check). SECURITY DEFINER backed.
 */
export async function storesWithBugReports(db: Db, openOnly: boolean): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_bug_reports(${openOnly}::boolean) as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids whose Home cards were not rebuilt in the last 20 hours. SECURITY DEFINER backed. */
export async function storesWithHomeCardsDue(db: Db, now = new Date()): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_home_cards_due(${now.toISOString()}::timestamptz) as id`,
  )
  return rows.map((r) => r.id)
}

/** Store ids with a draft whose stock hold has run out (#1030). SECURITY DEFINER backed. */
export async function storesWithExpiredDraftHolds(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`select stores_with_expired_draft_holds() as id`)
  return rows.map((r) => r.id)
}

/** Store ids with an open unpaid checkout draft (0233), for the nudge and 7-day expiry. SECURITY DEFINER backed. */
export async function storesWithOpenCheckoutDrafts(db: Db): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_open_checkout_drafts() as id`,
  )
  return rows.map((r) => r.id)
}

/**
 * The store an SES bounce or complaint belongs to (core `email-suppression`): the store a
 * `store-id` message tag names, when that store exists, else the store whose sender domain sent
 * it. Null when neither matches (the platform address with no tag). SECURITY DEFINER backed.
 */
export async function storeForEmailFeedback(
  db: Db,
  hint: { storeTag: string | null; fromDomain: string | null },
): Promise<string | null> {
  if (hint.storeTag) {
    const rows = await db.execute<{ id: string | null }>(
      sql`select store_for_email_tag(${hint.storeTag}::uuid) as id`,
    )
    if (rows[0]?.id) return rows[0].id
  }
  if (hint.fromDomain) {
    const rows = await db.execute<{ id: string | null }>(
      sql`select store_for_sender_domain(${hint.fromDomain}) as id`,
    )
    if (rows[0]?.id) return rows[0].id
  }
  return null
}

// The worker's daily "which stores need this job" lookups, split out to keep this file small.
export * from './store-sweeps'
