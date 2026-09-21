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
