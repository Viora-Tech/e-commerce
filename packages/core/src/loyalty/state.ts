/** SOURCE OF TRUTH: Loyalty points app state — WHAT: whether the store installed the app, its settings, saving them under the `store.apps` lock, and the return window a delivered order's points wait for / WHY: hooks, the sweep, the API and the storefront read one shape */
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { lockStoreApps } from '../apps/locked'
import { parseAppsSettings, withAppSettings } from '../apps/settings'
import { parseReturnPolicy } from '../returns/policy'
import { syncV1RuleNumbers } from './rules'
import {
  LOYALTY_APP_ID,
  type LoyaltySettings,
  LoyaltySettingsSchema,
  parseLoyaltySettings,
} from './settings'

const DAY_MS = 86_400_000

/** Whether the store installed the app, and its settings (defaults when never saved). */
export async function loyaltyState(
  tx: StoreTx,
  storeId: string,
): Promise<{ installed: boolean; settings: LoyaltySettings }> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  return {
    installed: apps.installed.includes(LOYALTY_APP_ID),
    settings: parseLoyaltySettings(apps.settings?.[LOYALTY_APP_ID]),
  }
}

/** Saves the app's settings; every writer of `store.apps` takes its row lock first. */
export async function saveLoyaltySettings(
  tx: StoreTx,
  storeId: string,
  input: unknown,
): Promise<LoyaltySettings> {
  const next = LoyaltySettingsSchema.parse(input)
  const locked = await lockStoreApps(tx, storeId)
  const prev = parseLoyaltySettings(locked.settings?.[LOYALTY_APP_ID])
  const apps = withAppSettings(locked, LOYALTY_APP_ID, next)
  await tx.update(store).set({ apps }).where(eq(store.id, storeId))
  await syncV1RuleNumbers({ storeId, tx }, prev, next)
  return next
}

/**
 * How long a delivered order's points wait: the store's return window (Settings, Returns) while
 * shoppers can ask for returns, so points never land for goods that come back; none otherwise.
 */
export async function pointsHoldMs(tx: StoreTx, storeId: string): Promise<number> {
  const [s] = await tx.select({ returns: store.returns }).from(store).where(eq(store.id, storeId))
  const policy = parseReturnPolicy(s?.returns)
  return policy.enabled ? policy.windowDays * DAY_MS : 0
}
