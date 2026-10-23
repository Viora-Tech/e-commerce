/** SOURCE OF TRUTH: affiliate program storage — WHAT: reads and writes the program in store.apps / WHY: one place for "is it installed" and "what are the rules" */
import { CommerceError, parseAppsSettings, withAppSettings } from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import {
  AFFILIATES_ID,
  type AffiliateSettings,
  AffiliateSettingsSchema,
  parseAffiliateSettings,
} from './settings'

/** A refusal the admin and the storefront narrow on by `code`. */
export class AffiliateError extends CommerceError {}

/** Whether the store has the app installed, and its program. */
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

/** Saves the whole program; the install list and other apps are untouched. */
export async function saveAffiliateSettings(
  tx: StoreTx,
  storeId: string,
  input: AffiliateSettings,
): Promise<AffiliateSettings> {
  const next = AffiliateSettingsSchema.parse(input)
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = withAppSettings(parseAppsSettings(s?.apps), AFFILIATES_ID, next)
  await tx.update(store).set({ apps }).where(eq(store.id, storeId))
  return next
}
