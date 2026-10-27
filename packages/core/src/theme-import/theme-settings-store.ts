/** SOURCE OF TRUTH: saving an imported theme's own Theme settings — WHAT: the theme's `settings_schema.json` groups as stored, and a Customize save of their values into the import record (`theme_import.settings`, what the renderer reads as `settings.*`) / WHY: an imported theme keeps its global settings (favicon, colours, fonts, cart…) there, not in our theme row; moving the record's `updatedAt` makes the storefront and the canvas render the new values */
import { type StoreTx, themeFile, themeImport } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { ThemeLibraryError, touchTheme } from '../theme/library'
import { themeImportFor } from './bundle-store'
import { parseThemeJson } from './schema'
import {
  cleanThemeSettings,
  type ThemeSettingsSchemaGroup,
  themeSettingsById,
} from './theme-settings'

const SETTINGS_SCHEMA_PATH = 'config/settings_schema.json'

/** The theme's `config/settings_schema.json` groups, as saved (empty when the file is missing). */
async function themeSettingsSchema(
  tx: StoreTx,
  themeId: string,
): Promise<ThemeSettingsSchemaGroup[]> {
  const [file] = await tx
    .select({ body: themeFile.body, encoding: themeFile.encoding })
    .from(themeFile)
    .where(and(eq(themeFile.themeId, themeId), eq(themeFile.path, SETTINGS_SCHEMA_PATH)))
  if (file?.encoding !== 'utf8') return []
  const parsed = parseThemeJson<unknown>(file.body)
  return Array.isArray(parsed)
    ? parsed.filter((g): g is ThemeSettingsSchemaGroup => !!g && typeof g === 'object')
    : []
}

/**
 * Saves Theme settings values of an imported theme: only settings its schema declares, each
 * cleaned (`cleanThemeSetting`), over what is stored; everything else the record keeps
 * (static sections, app embeds, colour schemes not sent) stays. Returns the stored settings.
 */
export async function saveImportedThemeSettings(
  tx: StoreTx,
  input: { themeId: string; values: Record<string, unknown>; by?: string | undefined },
): Promise<Record<string, unknown>> {
  const record = await themeImportFor(tx, input.themeId)
  if (!record) throw new ThemeLibraryError('THEME_NOT_FOUND', 'This theme was not imported')
  const schema = [...themeSettingsById(await themeSettingsSchema(tx, input.themeId)).values()]
  const settings = { ...record.settings, ...cleanThemeSettings(schema, input.values) }
  // The renderer caches a theme per import record version: moving it on shows the new values.
  await tx
    .update(themeImport)
    .set({ settings, updatedAt: new Date() })
    .where(eq(themeImport.themeId, input.themeId))
  await touchTheme(tx, input.themeId, input.by)
  return settings
}
