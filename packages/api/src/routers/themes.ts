import { settingsSecret } from '@commerce/config'
import {
  commitTemplateDrafts,
  createTemplateAlternate,
  createThemeFromPreset,
  deleteCustomSection,
  deleteTemplateAlternate,
  deleteTheme,
  discardTemplateDrafts,
  duplicateTheme,
  ensureMainTheme,
  getTheme,
  importedSectionCounts,
  importedThemeIds,
  listCustomSections,
  listTemplates,
  listThemes,
  loadLoopCatalog,
  loadLoopValues,
  loadSourceCatalog,
  loadSourceValues,
  loadTemplate,
  permissions,
  previewCollectionProducts,
  publishTheme,
  renameCustomSection,
  renameTheme,
  SECTION_GROUPS,
  SETTING_KINDS,
  saveCustomSection,
  saveTemplateDraft,
  setThemeThumbnail,
  signThemePreviewToken,
  TEMPLATE_KINDS,
  TEMPLATE_SUFFIX,
  THEME_PRESET_IDS,
  ThemeLibraryError,
  type ThemeRecord,
  ThemeSchema,
  themesWithDrafts,
  touchTheme,
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
import { themePreviewContext } from '../services/theme-preview.service'
import {
  decodeThumbnail,
  InvalidThumbnail,
  THUMBNAIL_DATA_URL_MAX,
  uploadThumbnail,
} from '../services/theme-thumbnail.service'

const IdInput = z.object({ id: z.string().uuid() })

const TemplateKeyInput = z.enum([...TEMPLATE_KINDS, ...SECTION_GROUPS])
const TemplateRef = z.object({
  themeId: z.string().uuid(),
  template: TemplateKeyInput,
  suffix: z.string().regex(TEMPLATE_SUFFIX).default(''),
})

/** Puck data, validated loosely: every section needs a type and an id; blocks own their props. */
const TemplateDataInput = z.object({
  root: z.object({ props: z.record(z.string(), z.unknown()).optional() }).passthrough(),
  content: z
    .array(
      z.object({
        type: z.string().min(1).max(60),
        props: z.object({ id: z.string().min(1).max(80) }).catchall(z.unknown()),
      }),
    )
    .max(60),
  zones: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Theme templates for the Customize editor. Edits are drafts the preview renders;
 * `commit` (Save) makes them the theme's saved templates, which for the live theme
 * is what shoppers see.
 */
const templatesRouter = {
  /** What the Customize preview needs to draw the header and footer as the storefront does. */
  previewContext: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    themePreviewContext(context.tx, context.scope.storeId),
  ),

  list: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ themeId: z.string().uuid() }))
    .handler(({ context, input }) => listTemplates(context.tx, input.themeId)),

  get: can(permissions.ONLINE_STORE_READ)
    .input(TemplateRef)
    .handler(({ context, input }) =>
      loadTemplate(context.tx, input.themeId, input.template, input.suffix, { withDraft: true }),
    ),

  saveDraft: can(permissions.ONLINE_STORE_WRITE)
    .input(TemplateRef.extend({ data: TemplateDataInput }))
    .handler(({ context, input }) =>
      libraryErrors(async () => {
        await saveTemplateDraft(context.tx, context.scope.storeId, input)
        return { ok: true as const }
      }),
    ),

  commit: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ themeId: z.string().uuid() }))
    .handler(({ context, input }) =>
      libraryErrors(async () => {
        const saved = await commitTemplateDrafts(context.tx, input.themeId)
        if (saved > 0) await touchTheme(context.tx, input.themeId, savedBy(context))
        return { saved }
      }),
    ),

  /** Dynamic sources a template's settings can connect to (the editor's picker). */
  sources: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ template: TemplateKeyInput }))
    .handler(({ context, input }) => loadSourceCatalog(context.tx, input.template)),

  /** Values of connected sources for the Customize preview's chosen product or collection. */
  sourceValues: can(permissions.ONLINE_STORE_READ)
    .input(
      z.object({
        paths: z.array(z.string().max(300)).max(100),
        productId: z.string().uuid().nullish(),
        collectionId: z.string().uuid().nullish(),
      }),
    )
    .handler(({ context, input }) =>
      loadSourceValues(context.tx, input.paths, {
        storeId: context.scope.storeId,
        productId: input.productId,
        collectionId: input.collectionId,
      }),
    ),

  /** What a list (loop) can read: storefront-visible content types with their fields, collections. */
  loopSources: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadLoopCatalog(context.tx),
  ),

  /** Sample rows for the Customize preview of lists bound to store data. */
  loopValues: can(permissions.ONLINE_STORE_READ)
    .input(
      z.object({
        loops: z
          .array(
            z.object({
              source: z.string().max(260),
              limit: z.number().int().min(1).max(50),
              map: z.record(
                z.string().max(64),
                z.object({ from: z.string().max(64), kind: z.enum(SETTING_KINDS) }),
              ),
            }),
          )
          .max(20),
      }),
    )
    .handler(({ context, input }) =>
      loadLoopValues(context.tx, input.loops, {
        collectionProducts: (handle, limit) => previewCollectionProducts(context.tx, handle, limit),
      }),
    ),

  discard: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ themeId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      await discardTemplateDrafts(context.tx, input.themeId)
      return { ok: true as const }
    }),

  create: can(permissions.ONLINE_STORE_WRITE)
    .input(TemplateRef.extend({ basedOn: z.string().regex(TEMPLATE_SUFFIX).optional() }))
    .handler(({ context, input }) =>
      libraryErrors(() => createTemplateAlternate(context.tx, context.scope.storeId, input)),
    ),

  delete: can(permissions.ONLINE_STORE_WRITE)
    .input(TemplateRef)
    .handler(({ context, input }) =>
      libraryErrors(async () => {
        await deleteTemplateAlternate(context.tx, input)
        return { ok: true as const }
      }),
    ),
}

/**
 * "My sections": the store's own saved sections, a library shared by every theme.
 * The block is validated for shape and size in core (`prepareCustomSection`).
 */
const customSectionsRouter = {
  list: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    listCustomSections(context.tx, context.scope.storeId),
  ),

  save: can(permissions.ONLINE_STORE_WRITE)
    .input(
      z.object({
        name: z.string().max(200),
        block: z.object({
          type: z.string().min(1).max(60),
          props: z.object({ id: z.string().min(1).max(80) }).catchall(z.unknown()),
        }),
      }),
    )
    .handler(({ context, input }) =>
      libraryErrors(() => saveCustomSection(context.tx, context.scope.storeId, input)),
    ),

  rename: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.string().uuid(), name: z.string().max(200) }))
    .handler(({ context, input }) =>
      libraryErrors(async () => {
        await renameCustomSection(context.tx, context.scope.storeId, input)
        return { ok: true as const }
      }),
    ),

  delete: can(permissions.ONLINE_STORE_WRITE)
    .input(IdInput)
    .handler(async ({ context, input }) => {
      await deleteCustomSection(context.tx, context.scope.storeId, input.id)
      return { ok: true as const }
    }),
}

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

async function libraryErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ThemeLibraryError) {
      const code = err.code === 'THEME_NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST'
      throw new ORPCError(code, { message: err.message })
    }
    throw err
  }
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

/** The member saving, as "Last saved by" shows them: their name, else their email. */
const savedBy = (context: { session: { user: { name?: string | null; email: string } } }) =>
  context.session.user.name?.trim() || context.session.user.email

/** Online Store › Themes: the library, Shopify style. One theme is live (`main`). */
export const themesRouter = {
  templates: templatesRouter,
  customSections: customSectionsRouter,
  import: importRouter,

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
      libraryErrors(async () =>
        presentOne(context.tx, context.scope.storeId, await publishTheme(context.tx, input.id)),
      ),
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
