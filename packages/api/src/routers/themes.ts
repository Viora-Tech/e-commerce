import { settingsSecret } from '@commerce/config'
import {
  createThemeFromPreset,
  deleteTheme,
  duplicateTheme,
  ensureMainTheme,
  getTheme,
  importedSectionCounts,
  importedThemeIds,
  listThemes,
  listThemeVersions,
  liveThemeLogoUrl,
  permissions,
  publishTheme,
  renameTheme,
  restoreThemeVersion,
  setThemeThumbnail,
  signThemePreviewToken,
  snapshotTheme,
  THEME_PRESET_IDS,
  type ThemeRecord,
  ThemeSchema,
  themesWithDrafts,
  updateThemeSettings,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, heavy } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { storageProviderFor } from '../services/media.service'
import {
  importThemeZip,
  liquidEditorInfo,
  renderLiquidForEditor,
  themeImportReport,
} from '../services/theme-import.service'
import {
  decodeThumbnail,
  InvalidThumbnail,
  THUMBNAIL_DATA_URL_MAX,
  uploadThumbnail,
} from '../services/theme-thumbnail.service'
import { IdInput, libraryErrors, savedBy } from './theme-helpers'
import { customSectionsRouter, templatesRouter } from './theme-templates'

/** The largest theme zip the import accepts (Shopify's own themes are a few MB). */
const THEME_ZIP_MAX_BYTES = 50 * 1024 * 1024

const LiquidSectionInput = z.object({
  id: z.string().min(1).max(80),
  type: z.string().min(1).max(100),
  settings: z.record(z.string(), z.unknown()),
  blocks: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        type: z.string().min(1).max(100),
        disabled: z.boolean().optional(),
        settings: z.record(z.string(), z.unknown()),
      }),
    )
    .max(100),
  location: z.string().min(1).max(40),
  index: z.number().int().min(0).max(100),
})

/**
 * Imported Shopify themes: upload a zip (always a NEW unpublished theme), read its
 * import report, and the Customize canvas's renders of its Liquid sections.
 */
const importRouter = {
  // The store's import budget (`heavy`): an import unpacks a zip and downloads its files.
  shopify: can(permissions.ONLINE_STORE_WRITE)
    .use(heavy('import'))
    .input(
      z.object({
        file: z
          .instanceof(File)
          .refine(
            (f) => f.size > 0 && f.size <= THEME_ZIP_MAX_BYTES,
            'Upload a theme zip under 50 MB',
          ),
        shopifyHost: z.string().trim().max(200).optional(),
      }),
    )
    .handler(({ context, input }) =>
      libraryErrors(async () => {
        const { storeId } = context.scope
        const result = await importThemeZip(context.tx, storeId, input)
        const created = await getTheme(context.tx, result.themeId)
        if (!created) throw new ORPCError('NOT_FOUND', { message: 'Theme not found' })
        return {
          theme: await presentOne(context.tx, storeId, created),
          report: result.report,
        }
      }),
    ),

  report: can(permissions.ONLINE_STORE_READ)
    .input(IdInput)
    .handler(async ({ context, input }) => {
      const found = await themeImportReport(context.tx, input.id)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'This theme was not imported' })
      return found
    }),

  /** Schemas, labels and the theme's head for Customize; null for our own themes. */
  editor: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ themeId: z.string().uuid() }))
    .handler(({ context, input }) =>
      liquidEditorInfo(context.tx, context.scope.storeId, input.themeId),
    ),

  /** The canvas's HTML for imported sections, keyed by section id (scripts removed). */
  render: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ themeId: z.string().uuid(), sections: z.array(LiquidSectionInput).max(60) }))
    .handler(({ context, input }) =>
      renderLiquidForEditor(context.tx, context.scope.storeId, input.themeId, input.sections),
    ),
}

/** What the library shows beside a theme beyond its row: unsaved edits and imported sections. */
type ThemeFacts = { imported: boolean; hasDraft: boolean; sectionCount: number | null }

const NO_FACTS: ThemeFacts = { imported: false, hasDraft: false, sectionCount: null }

/**
 * A theme as the admin sees it, with a signed token that lets the storefront render
 * exactly this theme (for the library thumbnail, the Preview button and the editor).
 */
function present(storeId: string, t: ThemeRecord, facts: ThemeFacts = NO_FACTS) {
  return {
    ...t,
    /** Imported from a Shopify theme zip: renders through the Liquid engine, has a report. */
    imported: facts.imported,
    /** Customize holds edits that are not saved yet. */
    hasDraft: facts.hasDraft,
    /** Liquid sections an imported theme brought; null for our own (they share one library). */
    sectionCount: facts.sectionCount,
    previewToken: signThemePreviewToken({ secret: settingsSecret(), storeId, themeId: t.id }),
  }
}

type LibraryTx = Parameters<typeof importedThemeIds>[0]

/** The facts for every theme of the store, read once for a whole list. */
async function libraryFacts(tx: LibraryTx): Promise<(id: string) => ThemeFacts> {
  const [imported, drafts, counts] = await Promise.all([
    importedThemeIds(tx),
    themesWithDrafts(tx),
    importedSectionCounts(tx),
  ])
  return (id) => ({
    imported: imported.has(id),
    hasDraft: drafts.has(id),
    sectionCount: counts.get(id) ?? null,
  })
}

/** `present`, with the facts read for this one theme. */
async function presentOne(tx: LibraryTx, storeId: string, t: ThemeRecord) {
  return present(storeId, t, (await libraryFacts(tx))(t.id))
}

/**
 * Version history (`@commerce/core` theme/versions): what went live, newest first, and
 * restoring one into the drafts. Restore never publishes.
 */
const versionsRouter = {
  list: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ themeId: z.string().uuid() }))
    .handler(({ context, input }) => listThemeVersions(context.tx, input.themeId)),

  restore: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ themeId: z.string().uuid(), batchId: z.string().uuid() }))
    .handler(({ context, input }) =>
      libraryErrors(async () => ({
        restored: await restoreThemeVersion(context.tx, context.scope.storeId, input),
      })),
    ),
}

/** Online Store › Themes: the library, Shopify style. One theme is live (`main`). */
export const themesRouter = {
  templates: templatesRouter,
  versions: versionsRouter,
  customSections: customSectionsRouter,
  import: importRouter,

  /** The live theme's logo for the admin sidebar (every page load): one small read. */
  logo: can(permissions.ONLINE_STORE_READ).handler(({ context }) => liveThemeLogoUrl(context.tx)),

  list: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
    const { storeId } = context.scope
    await ensureMainTheme(context.tx, storeId)
    const themes = await listThemes(context.tx)
    const facts = await libraryFacts(context.tx)
    return themes.map((t) => present(storeId, t, facts(t.id)))
  }),

  get: can(permissions.ONLINE_STORE_READ)
    .input(IdInput)
    .handler(async ({ context, input }) => {
      const found = await getTheme(context.tx, input.id)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Theme not found' })
      return presentOne(context.tx, context.scope.storeId, found)
    }),

  create: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ preset: z.enum(THEME_PRESET_IDS), name: z.string().max(50).optional() }))
    .handler(({ context, input }) =>
      libraryErrors(async () =>
        present(
          context.scope.storeId,
          await createThemeFromPreset(context.tx, context.scope.storeId, input, savedBy(context)),
        ),
      ),
    ),

  update: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.string().uuid(), settings: ThemeSchema }))
    .handler(({ context, input }) =>
      libraryErrors(async () =>
        presentOne(
          context.tx,
          context.scope.storeId,
          await updateThemeSettings(context.tx, input.id, input.settings, savedBy(context)),
        ),
      ),
    ),

  rename: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.string().uuid(), name: z.string().max(80) }))
    .handler(({ context, input }) =>
      libraryErrors(async () =>
        presentOne(
          context.tx,
          context.scope.storeId,
          await renameTheme(context.tx, input.id, input.name, savedBy(context)),
        ),
      ),
    ),

  duplicate: can(permissions.ONLINE_STORE_WRITE)
    .input(IdInput)
    .handler(({ context, input }) =>
      libraryErrors(async () =>
        presentOne(
          context.tx,
          context.scope.storeId,
          await duplicateTheme(context.tx, context.scope.storeId, input.id, savedBy(context)),
        ),
      ),
    ),

  /**
   * The home page picture Customize takes on Save (a webp data URL, see
   * theme-thumbnail.service). Not a save itself: the theme's "Last saved" stays put.
   */
  thumbnail: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.string().uuid(), image: z.string().max(THUMBNAIL_DATA_URL_MAX) }))
    .handler(({ context, input }) =>
      libraryErrors(async () => {
        let bytes: Uint8Array
        try {
          bytes = decodeThumbnail(input.image)
        } catch (err) {
          if (err instanceof InvalidThumbnail) {
            throw new ORPCError('BAD_REQUEST', { message: err.message })
          }
          throw err
        }
        // Read under RLS first: another store's theme id never reaches storage.
        if (!(await getTheme(context.tx, input.id))) {
          throw new ORPCError('NOT_FOUND', { message: 'Theme not found' })
        }
        const { storeId } = context.scope
        const { storage: registry } = await storeRegistries(context.tx, storeId)
        const storage = await storageProviderFor(context.tx, storeId, registry, settingsSecret())
        const url = await uploadThumbnail(storage, { storeId, themeId: input.id, bytes })
        await setThemeThumbnail(context.tx, input.id, url)
        return { url }
      }),
    ),

  /** Making a theme live is its own permission, as Shopify separates edit and publish. */
  publish: can(permissions.ONLINE_STORE_PUBLISH)
    .input(IdInput)
    .handler(({ context, input }) =>
      libraryErrors(async () => {
        const wasLive = (await getTheme(context.tx, input.id))?.role === 'main'
        const live = await publishTheme(context.tx, input.id)
        // Publishing the theme that is already live changes nothing, so it adds no version.
        if (!wasLive) {
          await snapshotTheme(context.tx, context.scope.storeId, {
            themeId: live.id,
            reason: 'publish',
            by: savedBy(context),
          })
        }
        return presentOne(context.tx, context.scope.storeId, live)
      }),
    ),

  delete: can(permissions.ONLINE_STORE_WRITE)
    .input(IdInput)
    .handler(({ context, input }) =>
      libraryErrors(async () => {
        await deleteTheme(context.tx, input.id)
        return { ok: true as const }
      }),
    ),
}
