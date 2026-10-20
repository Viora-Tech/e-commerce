import { appSettingsOf, parseAppsSettings } from '@commerce/core'
import { order, type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { ExperimentAssignment } from './assign'
import { experimentEvent } from './schema'
import {
  GROWTHBOOK_ID,
  type GrowthbookConnection,
  growthbookConnection,
  parseGrowthbookSettings,
} from './settings'

/**
 * Reads the store's connection and writes the GrowthBook app's events (`experiment_event`),
 * server side, in the caller's store transaction. The storefront calls these from its
 * experiments endpoint after checking the shopper allowed analytics; GrowthBook reads the rows
 * back through its SQL data source.
 */

/** The store's SDK connection when the app is installed and set up, else null. */
export async function growthbookConnectionFor(
  tx: StoreTx,
  storeId: string,
): Promise<GrowthbookConnection | null> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  if (!apps.installed.includes(GROWTHBOOK_ID)) return null
  return growthbookConnection(parseGrowthbookSettings(appSettingsOf(apps, GROWTHBOOK_ID)))
}

/** An order counts as a conversion only while fresh: its thank-you page, not an old link. */
const PURCHASE_WINDOW_MS = 24 * 60 * 60 * 1000

/** "Experiment viewed": one row per visitor, experiment and variation (later views add nothing). */
export async function recordExposures(
  tx: StoreTx,
  storeId: string,
  visitorId: string,
  seen: readonly ExperimentAssignment[],
): Promise<void> {
  if (seen.length === 0) return
  await tx
    .insert(experimentEvent)
    .values(
      seen.map((a) => ({
        storeId,
        visitorId,
        kind: 'exposure' as const,
        experimentKey: a.key,
        variationId: a.variationId,
      })),
    )
    .onConflictDoNothing()
}

/**
 * A purchase by this visitor, with the order's total: once per order, and only for an order of
 * this store placed in the last day. False when nothing was recorded.
 */
export async function recordPurchase(
  tx: StoreTx,
  storeId: string,
  visitorId: string,
  orderId: string,
  now = new Date(),
): Promise<boolean> {
  const [o] = await tx
    .select({ id: order.id, totalPaise: order.totalPaise, placedAt: order.placedAt })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o || now.getTime() - o.placedAt.getTime() > PURCHASE_WINDOW_MS) return false
  const rows = await tx
    .insert(experimentEvent)
    .values({ storeId, visitorId, kind: 'purchase', orderId: o.id, valuePaise: o.totalPaise })
    .onConflictDoNothing()
    .returning({ id: experimentEvent.id })
  return rows.length > 0
}
