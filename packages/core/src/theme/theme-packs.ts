/** SOURCE OF TRUTH: theme packs — WHAT the opt-in section packs a theme has turned on, kept per theme in `theme.settings.themePacks`; a theme without its own list falls back to the older store-level `store.apps.settings.core.themePacks` (beside the tax switches) / WHY a pack's sections (Zero Drift, the Waimers store's own Shopify theme) belong to one store, so the editor's Add menu offers them only where turned on; saved pages using them render for every store either way. Pure: no database, safe for client components. */
import { z } from 'zod'
import { appSettingsOf, parseAppsSettings } from '../apps/settings'

/**
 * Every theme pack. `zero-drift` is `ZERO_DRIFT_PACK` in `@commerce/blocks/puck`, which lists
 * its sections (`THEME_PACK_SECTIONS`).
 */
export const THEME_PACK_IDS = ['zero-drift'] as const
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

/**
 * Packs are per theme: a theme keeps its own list in `theme.settings.themePacks`, beside (not
 * inside) the colours and fonts `ThemeSchema` parses, so a settings save never touches it.
 */
export const THEME_OWN_PACKS_KEY = 'themePacks'

/**
 * A theme's own packs from its raw `theme.settings`; null when it has no list of its own (themes
 * from before packs moved to the theme), so the store-level list still decides for those.
 */
export function parseOwnThemePacks(settingsRaw: unknown): ThemePackId[] | null {
  if (typeof settingsRaw !== 'object' || settingsRaw === null) return null
  const packs = (settingsRaw as Record<string, unknown>)[THEME_OWN_PACKS_KEY]
  return Array.isArray(packs) ? [...new Set(packs.filter(isPack))] : null
}

/**
 * The packs a theme's editor offers: its own list when it has one, else the store-level list
 * (`store.apps.settings.core.themePacks`), so Waimers' live theme keeps Zero Drift as before.
 */
export function effectiveThemePacks(
  own: readonly ThemePackId[] | null,
  storePacks: readonly ThemePackId[],
): ThemePackId[] {
  return [...new Set(own ?? storePacks)]
}

/** A settings document to store: `settings` with the theme's own packs beside it (none: as is). */
export function withOwnThemePacks<T extends object>(
  settings: T,
  own: readonly ThemePackId[] | null,
): T {
  return own === null ? settings : { ...settings, [THEME_OWN_PACKS_KEY]: [...new Set(own)] }
}
