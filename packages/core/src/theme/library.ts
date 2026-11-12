import { newId, type StoreTx, store, theme, themeTemplate } from '@commerce/db'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { storeAppsRow } from '../apps/store-apps'
import { CommerceError } from '../errors'
import { copyThemeImport } from '../theme-import/bundle-store'
import { applyThemePreset } from './presets'
import { defaultTheme, parseTheme, type Theme, type ThemePresetId, ThemeSchema } from './schema'
import { copyTemplates } from './templates'
import { BLANK_THEME_TEMPLATES, blankTemplate } from './templates-data'
import {
  effectiveThemePacks,
  parseOwnThemePacks,
  parseThemePacks,
  THEME_OWN_PACKS_KEY,
  type ThemePackId,
  withOwnThemePacks,
} from './theme-packs'

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
  /**
   * The theme's own section packs (`theme.settings.themePacks`); null for a theme from before
   * packs were per theme, which follows the store-level list (`themePacksOf`).
   */
  ownPacks: ThemePackId[] | null
  /** The home page as a small webp (Customize takes it on Save); null until the first one. */
  thumbnailUrl: string | null
  /** Who saved it last, as their name (or email); null for themes saved before it was kept. */
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

export type ThemeLibraryErrorCode =
  | 'THEME_NOT_FOUND'
  | 'THEME_LIVE'
  | 'THEME_LIMIT'
  | 'THEME_NAME_INVALID'
  /** A connected setting reads a dynamic source it cannot have. */
  | 'THEME_SOURCE_INVALID'
  /** A "My sections" entry breaks a rule (name, size, how many). */
  | 'THEME_SECTION_INVALID'
  /** An uploaded Shopify theme zip that cannot be imported. */
  | 'THEME_IMPORT_INVALID'
  /** A file saved in Edit code that does not read (JSON, Liquid, CSS) or may not be changed. */
  | 'THEME_CODE_INVALID'

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
    ownPacks: parseOwnThemePacks(row.settings),
    thumbnailUrl: row.thumbnailUrl,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  }
}

/** The `updatedBy` column for a save; left alone when the caller does not say who. */
const savedBy = (by: string | undefined) => (by ? { updatedBy: by } : {})

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
 * The live theme's logo URL, or null: the admin sidebar's brand mark on every page load. Reads
 * one JSON path of the live row instead of every theme's whole settings document.
 */
export async function liveThemeLogoUrl(tx: StoreTx): Promise<string | null> {
  const [row] = await tx
    .select({ url: sql<string | null>`${theme.settings} #>> '{brand,logo,url}'` })
    .from(theme)
    .where(eq(theme.role, 'main'))
  return row?.url ?? null
}

/** The store-level theme packs (`parseThemePacks`): what themes without their own list offer. */
export async function storeThemePacks(tx: StoreTx, storeId: string): Promise<ThemePackId[]> {
  const s = await storeAppsRow(tx, storeId)
  return parseThemePacks(s.apps)
}

/**
 * The packs a theme's editor offers (`effectiveThemePacks`): the theme's own list, or for a theme
 * from before packs were per theme, the store-level one.
 */
export async function themePacksOf(
  tx: StoreTx,
  storeId: string,
  record: Pick<ThemeRecord, 'ownPacks'>,
): Promise<ThemePackId[]> {
  if (record.ownPacks) return [...record.ownPacks]
  return effectiveThemePacks(null, await storeThemePacks(tx, storeId))
}

/**
 * Turns one theme's packs to exactly `packs` (Online Store › Themes, "Section packs"). Only
 * `theme.settings.themePacks` changes (`jsonb_set`), so the look and "Last saved" stay as they
 * were. Returns the packs as now stored.
 */
export async function saveThemePacks(
  tx: StoreTx,
  themeId: string,
  packs: readonly ThemePackId[],
): Promise<ThemePackId[]> {
  await mustGet(tx, themeId)
  const [row] = await tx
    .update(theme)
    .set({
      settings: sql`jsonb_set(${theme.settings}, ${`{${THEME_OWN_PACKS_KEY}}`}::text[], ${JSON.stringify([...new Set(packs)])}::jsonb, true)`,
    })
    .where(eq(theme.id, themeId))
    .returning({ settings: theme.settings })
  if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${themeId}`)
  return parseOwnThemePacks(row.settings) ?? []
}

/** The live theme's id, or null before the store has one. */
export async function liveThemeId(tx: StoreTx): Promise<string | null> {
  const [row] = await tx.select({ id: theme.id }).from(theme).where(eq(theme.role, 'main'))
  return row?.id ?? null
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
 * has none yet (stores created after the migration's backfill ran). A brand-new store (no
 * legacy document either) starts from `preset` when given: merchant signup passes `minimal`,
 * so a new store never opens on the Waimers look.
 */
export async function ensureMainTheme(
  tx: StoreTx,
  storeId: string,
  preset?: ThemePresetId,
): Promise<ThemeRecord> {
  const [row] = await tx.select().from(theme).where(eq(theme.role, 'main'))
  if (row) return toRecord(row)
  const [s] = await tx.select({ theme: store.theme }).from(store).where(eq(store.id, storeId))
  const settings =
    s?.theme == null && preset ? applyThemePreset(defaultTheme, preset) : parseTheme(s?.theme)
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
 * favicon) and templates, which belong to the store rather than the look (less any
 * imported Shopify sections, which need the live theme's files).
 */
export async function createThemeFromPreset(
  tx: StoreTx,
  storeId: string,
  input: { preset: ThemePresetId; name?: string | undefined },
  by?: string,
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
      // A new theme starts with no section packs; the merchant turns one on for it.
      settings: withOwnThemePacks(settings, []),
      updatedBy: by ?? null,
    })
    .returning()
  if (!created) throw new Error('theme insert returned nothing')
  // The content (home page, page layouts) belongs to the store; a new look keeps it. Not an
  // imported theme's own Shopify sections: their Liquid lives in that theme's files, which a
  // preset theme does not get, so they would render blank. Those templates fall back to ours.
  await copyTemplates(tx, storeId, live.id, created.id, { withoutLiquid: true })
  return toRecord(created)
}

/** The name a blank theme gets when the merchant leaves it empty. */
const BLANK_THEME_NAME = 'Blank theme'

/**
 * "Start from scratch": a new unpublished theme with base settings (the Minimal preset, keeping
 * the live theme's logo and favicon, which belong to the store) and empty templates. Nothing is
 * copied from the live theme's templates: the header and footer groups hold only the Header and
 * the Footer, the home page is empty, and every other template is just its main section
 * (`blankTemplate`). No section packs.
 */
export async function createBlankTheme(
  tx: StoreTx,
  storeId: string,
  input: { name?: string | undefined },
  by?: string,
): Promise<ThemeRecord> {
  await assertRoom(tx)
  const live = await ensureMainTheme(tx, storeId)
  const settings = applyThemePreset({ ...defaultTheme, brand: live.settings.brand }, 'minimal')
  const [created] = await tx
    .insert(theme)
    .values({
      id: newId(),
      storeId,
      name: cleanName(input.name?.trim() ? input.name : BLANK_THEME_NAME),
      role: 'unpublished',
      preset: settings.preset,
      settings: withOwnThemePacks(settings, []),
      updatedBy: by ?? null,
    })
    .returning()
  if (!created) throw new Error('theme insert returned nothing')
  // Stored rows, so the storefront renders the blank groups and home page instead of falling back
  // to the code defaults (which carry an announcement bar, a hero and a newsletter).
  await tx.insert(themeTemplate).values(
    BLANK_THEME_TEMPLATES.map((template) => ({
      id: newId(),
      storeId,
      themeId: created.id,
      template,
      suffix: '',
      sections: blankTemplate(template),
    })),
  )
  return toRecord(created)
}

/** Saves a theme's settings (validated) and bumps its "last saved" time. */
export async function updateThemeSettings(
  tx: StoreTx,
  id: string,
  settings: unknown,
  by?: string,
): Promise<ThemeRecord> {
  const current = await mustGet(tx, id)
  const parsed = ThemeSchema.parse(settings)
  const [row] = await tx
    .update(theme)
    // The theme's own packs sit beside the settings and are not part of them: keep them.
    .set({
      settings: withOwnThemePacks(parsed, current.ownPacks),
      preset: parsed.preset,
      updatedAt: new Date(),
      ...savedBy(by),
    })
    .where(eq(theme.id, id))
    .returning()
  if (!row) throw new ThemeLibraryError('THEME_NOT_FOUND', `No theme ${id}`)
  return toRecord(row)
}

export async function renameTheme(
  tx: StoreTx,
  id: string,
  name: string,
  by?: string,
): Promise<ThemeRecord> {
  await mustGet(tx, id)
  const [row] = await tx
    .update(theme)
    .set({ name: cleanName(name), updatedAt: new Date(), ...savedBy(by) })
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
  by?: string,
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
      // The copy offers the same section packs the source does, now as its own list.
      settings: withOwnThemePacks(source.settings, await themePacksOf(tx, storeId, source)),
      // Same look and templates, so the same picture until the copy is saved in Customize.
      thumbnailUrl: source.thumbnailUrl,
      updatedBy: by ?? null,
    })
    .returning()
  if (!created) throw new Error('theme insert returned nothing')
  await copyTemplates(tx, storeId, source.id, created.id)
  await copyThemeImport(tx, storeId, source.id, created.id)
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

/**
 * Stores the theme's home page picture. Not a save: "Last saved" and its author stay as they
 * are, so a picture taken after Save never moves the library order.
 */
export async function setThemeThumbnail(tx: StoreTx, id: string, url: string): Promise<void> {
  await mustGet(tx, id)
  await tx.update(theme).set({ thumbnailUrl: url }).where(eq(theme.id, id))
}

/** Marks a theme saved now, by this member (Customize's Save of its templates). */
export async function touchTheme(tx: StoreTx, id: string, by?: string): Promise<void> {
  await tx
    .update(theme)
    .set({ updatedAt: new Date(), ...savedBy(by) })
    .where(eq(theme.id, id))
}
