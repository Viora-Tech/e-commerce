/** SOURCE OF TRUTH: store theme packs — WHAT the opt-in section packs a store has turned on, kept in `store.apps.settings.core.themePacks` (beside the tax switches) / WHY a pack's sections (Zero Drift, the Waimers store's own Shopify theme) belong to one store, so the editor's Add menu offers them only where turned on; saved pages using them render for every store either way. Pure: no database, safe for client components. */
import { z } from 'zod'
import { appSettingsOf, parseAppsSettings } from '../apps/settings'

/**
 * Every theme pack. `zero-drift` is `ZERO_DRIFT_PACK` in `@commerce/blocks/puck`, which lists
 * its sections (`THEME_PACK_SECTIONS`).
 */
const THEME_PACK_IDS = ['zero-drift'] as const
export type ThemePackId = (typeof THEME_PACK_IDS)[number]

/** The core plugin's `store.apps.settings` entry, shared with the tax switches. */
const CORE_KEY = 'core'

const CoreEntrySchema = z.object({ themePacks: z.unknown().optional() }).catchall(z.unknown())

const isPack = (value: unknown): value is ThemePackId =>
  (THEME_PACK_IDS as readonly unknown[]).includes(value)

/** The store's theme packs from a raw `store.apps` blob; unknown ids and broken data read as none. */
export function parseThemePacks(appsRaw: unknown): ThemePackId[] {
  const entry = CoreEntrySchema.safeParse(appSettingsOf(parseAppsSettings(appsRaw), CORE_KEY))
  const packs = entry.success ? entry.data.themePacks : undefined
  return Array.isArray(packs) ? [...new Set(packs.filter(isPack))] : []
}
