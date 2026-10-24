/** SOURCE OF TRUTH: affiliate store settings storage — WHAT: reads and writes the store-wide settings in store.apps / WHY: one place for "is it installed" and the tracking, hold, payout and TDS facts */
import { CommerceError, parseAppsSettings, withAppSettings } from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import {
  AFFILIATES_ID,
  type AffiliateSettings,
  parseAffiliateSettings,
  type StoreAffiliateSettings,
  StoreAffiliateSettingsSchema,
  storePart,
} from './settings'

/** A refusal the admin and the storefront narrow on by `code`. */
export class AffiliateError extends CommerceError {}

/**
 * Whether the store has the app installed, and its store entry. The entry may still carry the
 * v1 program keys (now in the default program, see ./programs); only the store-wide keys count.
 */
export async function affiliateState(
  tx: StoreTx,
  storeId: string,
): Promise<{ installed: boolean; settings: AffiliateSettings }> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  return {
    installed: apps.installed.includes(AFFILIATES_ID),
    settings: parseAffiliateSettings(apps.settings?.[AFFILIATES_ID]),
  }
}

export async function loadAffiliateSettings(
  tx: StoreTx,
  storeId: string,
): Promise<AffiliateSettings> {
  return (await affiliateState(tx, storeId)).settings
}

/**
 * Saves the store-wide settings. Any v1 program keys already in the entry are kept as they are
 * (unread), so rolling the code back to v1 still finds its program.
 */
export async function saveAffiliateSettings(
  tx: StoreTx,
  storeId: string,
  input: StoreAffiliateSettings,
): Promise<StoreAffiliateSettings> {
  const next = StoreAffiliateSettingsSchema.parse(storePart(input))
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const parsed = parseAppsSettings(s?.apps)
  const current = parsed.settings?.[AFFILIATES_ID]
  const kept = current && typeof current === 'object' ? (current as Record<string, unknown>) : {}
  const apps = withAppSettings(parsed, AFFILIATES_ID, { ...kept, ...next })
  await tx.update(store).set({ apps }).where(eq(store.id, storeId))
  return next
}
