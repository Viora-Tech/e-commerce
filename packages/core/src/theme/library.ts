import { newId, type StoreTx, store, theme } from '@commerce/db'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { applyThemePreset } from './presets'
import { defaultTheme, parseTheme, type Theme, type ThemePresetId, ThemeSchema } from './schema'

/**
 * The theme library: a store's themes, one of which (`main`) is live on the
 * storefront. Everything runs inside a store transaction, so RLS scopes every
 * query to the store; ids alone are enough in the where clauses.
 */

/** Shopify's limit; enough for drafts and seasonal looks without unbounded rows. */
export const MAX_THEMES = 20
const NAME_MAX = 50

export type ThemeRole = 'main' | 'unpublished'

export type ThemeRecord = {
  id: string
  name: string
  role: ThemeRole
  preset: string | null
  settings: Theme
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

export type ThemeLibraryErrorCode =
  | 'THEME_NOT_FOUND'
  | 'THEME_LIVE'
  | 'THEME_LIMIT'
  | 'THEME_NAME_INVALID'

export class ThemeLibraryError extends CommerceError {
  declare readonly code: ThemeLibraryErrorCode
  constructor(code: ThemeLibraryErrorCode, message: string) {
    super(code, message)
  }
}

const PRESET_NAMES: Record<ThemePresetId, string> = {
  waimers: 'Waimers',
  minimal: 'Minimal',
  bold: 'Bold',
  soft: 'Soft',
}

/** Display name for a preset, e.g. "Minimal". */
export const presetThemeName = (id: ThemePresetId): string => PRESET_NAMES[id]

function toRecord(row: typeof theme.$inferSelect): ThemeRecord {
  return {
    id: row.id,
    name: row.name,
    role: row.role === 'main' ? 'main' : 'unpublished',
    preset: row.preset,
    settings: parseTheme(row.settings),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  }
}

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.length > NAME_MAX) {
    throw new ThemeLibraryError('THEME_NAME_INVALID', `Theme names are 1 to ${NAME_MAX} characters`)
  }
  return trimmed
}

async function mustGet(tx: StoreTx, id: string): Promise<ThemeRecord> {
  const found = await getTheme(tx, id)
  if (!found) throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${id}`)
  return found
}

async function assertRoom(tx: StoreTx): Promise<void> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(theme)
  if ((row?.n ?? 0) >= MAX_THEMES) {
    throw new ThemeLibraryError('THEME_LIMIT', `A store can keep up to ${MAX_THEMES} themes`)
  }
}

/** Live theme first, then the library, most recently edited first. */
export async function listThemes(tx: StoreTx): Promise<ThemeRecord[]> {
  const rows = await tx
    .select()
    .from(theme)
    .orderBy(sql`case when ${theme.role} = 'main' then 0 else 1 end`, desc(theme.updatedAt))
  return rows.map(toRecord)
}

export async function getTheme(tx: StoreTx, id: string): Promise<ThemeRecord | null> {
  const [row] = await tx.select().from(theme).where(eq(theme.id, id))
  return row ? toRecord(row) : null
}

/**
 * The live theme's settings for rendering. Read only: a store that predates the
 * theme table falls back to its legacy `store.theme` document, then the default.
 */
export async function liveThemeSettings(tx: StoreTx, storeId: string): Promise<Theme> {
  const [row] = await tx
    .select({ settings: theme.settings })
    .from(theme)
    .where(eq(theme.role, 'main'))
  if (row) return parseTheme(row.settings)
  const [s] = await tx.select({ theme: store.theme }).from(store).where(eq(store.id, storeId))
  return parseTheme(s?.theme)
}

/**
 * The live theme, creating it from the legacy `store.theme` document when a store
 * has none yet (stores created after the migration's backfill ran).
 */
export async function ensureMainTheme(tx: StoreTx, storeId: string): Promise<ThemeRecord> {
  const [row] = await tx.select().from(theme).where(eq(theme.role, 'main'))
  if (row) return toRecord(row)
  const [s] = await tx.select({ theme: store.theme }).from(store).where(eq(store.id, storeId))
  const settings = parseTheme(s?.theme)
  const [created] = await tx
    .insert(theme)
    .values({
      id: newId(),
      storeId,
      name: presetThemeName(settings.preset),
      role: 'main',
      preset: settings.preset,
      settings,
      publishedAt: new Date(),
    })
    .returning()
  if (!created) throw new Error('theme insert returned nothing')
  return toRecord(created)
}

/**
 * A new unpublished theme from a preset. It keeps the live theme's brand (logo,
 * favicon), which belongs to the store rather than the look.
 */
export async function createThemeFromPreset(
  tx: StoreTx,
  storeId: string,
  input: { preset: ThemePresetId; name?: string | undefined },
): Promise<ThemeRecord> {
  await assertRoom(tx)
  const live = await ensureMainTheme(tx, storeId)
  const settings = applyThemePreset({ ...defaultTheme, brand: live.settings.brand }, input.preset)
  const [created] = await tx
    .insert(theme)
    .values({
      id: newId(),
      storeId,
      name: cleanName(input.name ?? presetThemeName(input.preset)),
      role: 'unpublished',
      preset: input.preset,
      settings,
    })
    .returning()
  if (!created) throw new Error('theme insert returned nothing')
  return toRecord(created)
}

/** Saves a theme's settings (validated) and bumps its "last saved" time. */
export async function updateThemeSettings(
  tx: StoreTx,
  id: string,
  settings: unknown,
): Promise<ThemeRecord> {
  await mustGet(tx, id)
  const parsed = ThemeSchema.parse(settings)
  const [row] = await tx
    .update(theme)
    .set({ settings: parsed, preset: parsed.preset, updatedAt: new Date() })
    .where(eq(theme.id, id))
    .returning()
  if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${id}`)
  return toRecord(row)
}

export async function renameTheme(tx: StoreTx, id: string, name: string): Promise<ThemeRecord> {
  await mustGet(tx, id)
  const [row] = await tx
    .update(theme)
    .set({ name: cleanName(name), updatedAt: new Date() })
    .where(eq(theme.id, id))
    .returning()
  if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${id}`)
  return toRecord(row)
}

/** An unpublished copy, named like Shopify's "Copy of …". */
export async function duplicateTheme(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<ThemeRecord> {
  const source = await mustGet(tx, id)
  await assertRoom(tx)
  const [created] = await tx
    .insert(theme)
    .values({
      id: newId(),
      storeId,
      name: cleanName(`Copy of ${source.name}`.slice(0, NAME_MAX)),
      role: 'unpublished',
      preset: source.preset,
      settings: source.settings,
    })
    .returning()
  if (!created) throw new Error('theme insert returned nothing')
  return toRecord(created)
}

/**
 * Makes a theme live. The previous live theme returns to the library. Demoting
 * first keeps the one-main-per-store index satisfied inside the transaction.
 */
export async function publishTheme(tx: StoreTx, id: string): Promise<ThemeRecord> {
  const target = await mustGet(tx, id)
  if (target.role === 'main') return target
  await tx
    .update(theme)
    .set({ role: 'unpublished' })
    .where(and(eq(theme.role, 'main'), ne(theme.id, id)))
  const [row] = await tx
    .update(theme)
    .set({ role: 'main', publishedAt: new Date() })
    .where(eq(theme.id, id))
    .returning()
  if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${id}`)
  return toRecord(row)
}

/** Deletes an unpublished theme; the live theme has to be replaced first. */
export async function deleteTheme(tx: StoreTx, id: string): Promise<void> {
  const target = await mustGet(tx, id)
  if (target.role === 'main') {
    throw new ThemeLibraryError('THEME_LIVE', 'Publish another theme before deleting the live one')
  }
  await tx.delete(theme).where(eq(theme.id, id))
}
