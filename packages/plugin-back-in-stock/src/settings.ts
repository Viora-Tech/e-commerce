import type { StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { backInStockSettings } from './schema'
import {
  type BackInStockStoreSettings,
  BackInStockStoreSettingsSchema,
  defaultBackInStockStoreSettings,
} from './settings-schema'

export * from './settings-schema'

/**
 * Platform-wide free quota and pause behaviour. Deployment config (env), not
 * per-store: read once at process start. Above quota, sends pause — the
 * remaining confirmed signups wait for next month (or an unlimited override)
 * rather than failing; there is no pay-as-you-go billing yet, so nothing here
 * ever charges a store.
 */
export type PlatformQuota = {
  freeEmailPerMonth: number
  freeWhatsappPerMonth: number
}

export function loadPlatformQuota(env: NodeJS.ProcessEnv = process.env): PlatformQuota {
  const email = Number(env.BACK_IN_STOCK_FREE_EMAIL_QUOTA)
  const whatsapp = Number(env.BACK_IN_STOCK_FREE_WHATSAPP_QUOTA)
  return {
    freeEmailPerMonth: Number.isFinite(email) && email >= 0 ? email : 1000,
    freeWhatsappPerMonth: Number.isFinite(whatsapp) && whatsapp >= 0 ? whatsapp : 0,
  }
}

export function parseBackInStockStoreSettings(raw: unknown): BackInStockStoreSettings {
  const result = BackInStockStoreSettingsSchema.safeParse(raw ?? {})
  return result.success ? result.data : defaultBackInStockStoreSettings
}

export async function loadStoreSettings(
  tx: StoreTx,
  storeId: string,
): Promise<BackInStockStoreSettings> {
  const [row] = await tx
    .select({ settings: backInStockSettings.settings })
    .from(backInStockSettings)
    .where(eq(backInStockSettings.storeId, storeId))
  return parseBackInStockStoreSettings(row?.settings)
}

/** Same shape zod's `.partial()` infers: every field optional and explicitly `| undefined`. */
export type BackInStockStoreSettingsPatch = {
  [K in keyof BackInStockStoreSettings]?: BackInStockStoreSettings[K] | undefined
}

export async function saveStoreSettings(
  tx: StoreTx,
  storeId: string,
  input: BackInStockStoreSettingsPatch,
): Promise<BackInStockStoreSettings> {
  const current = await loadStoreSettings(tx, storeId)
  const next = BackInStockStoreSettingsSchema.parse({ ...current, ...input })
  await tx
    .insert(backInStockSettings)
    .values({ storeId, settings: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: backInStockSettings.storeId,
      set: { settings: next, updatedAt: new Date() },
    })
  return next
}
