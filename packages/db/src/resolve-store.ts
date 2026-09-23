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

/** Store ids with baskets worth a recovery nudge, for the worker. SECURITY DEFINER backed. */
export async function storesWithAbandonedCarts(db: Db, cutoff: Date): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(
    sql`select stores_with_abandoned_carts(${cutoff}) as id`,
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
