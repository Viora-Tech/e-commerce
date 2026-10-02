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
  importedThemeIds,
  listCustomSections,
  listTemplates,
  listThemes,
  loadSourceCatalog,
  loadSourceValues,
  loadTemplate,
  permissions,
  publishTheme,
  renameCustomSection,
  renameTheme,
  SECTION_GROUPS,
  saveCustomSection,
  saveTemplateDraft,
  signThemePreviewToken,
  TEMPLATE_KINDS,
  TEMPLATE_SUFFIX,
  THEME_PRESET_IDS,
  ThemeLibraryError,
  type ThemeRecord,
  ThemeSchema,
  updateThemeSettings,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import {
  importThemeZip,
  liquidEditorInfo,
  renderLiquidForEditor,
  themeImportReport,
} from '../services/theme-import.service'
import { themePreviewContext } from '../services/theme-preview.service'

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
      libraryErrors(async () => ({
        saved: await commitTemplateDrafts(context.tx, input.themeId),
      })),
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
  shopify: can(permissions.ONLINE_STORE_WRITE)
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
        return { theme: present(storeId, created, true), report: result.report }
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

/**
 * A theme as the admin sees it, with a signed token that lets the storefront render
 * exactly this theme (for the library thumbnail, the Preview button and the editor).
 */
function present(storeId: string, t: ThemeRecord, imported = false) {
  return {
    ...t,
    /** Imported from a Shopify theme zip: renders through the Liquid engine, has a report. */
    imported,
    previewToken: signThemePreviewToken({ secret: settingsSecret(), storeId, themeId: t.id }),
  }
}

/** `present`, with the imported flag read for this one theme. */
async function presentOne(
  tx: Parameters<typeof importedThemeIds>[0],
  storeId: string,
  t: ThemeRecord,
) {
  return present(storeId, t, (await importedThemeIds(tx)).has(t.id))
}

/** Online Store › Themes: the library, Shopify style. One theme is live (`main`). */
export const themesRouter = {
  templates: templatesRouter,
  customSections: customSectionsRouter,
  import: importRouter,

  list: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
    const { storeId } = context.scope
    await ensureMainTheme(context.tx, storeId)
    const themes = await listThemes(context.tx)
    const imported = await importedThemeIds(context.tx)
    return themes.map((t) => present(storeId, t, imported.has(t.id)))
  }),

  get: can(permissions.ONLINE_STORE_READ)
    .input(IdInput)
    .handler(async ({ context, input }) => {
      const found = await getTheme(context.tx, input.id)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Theme not found' })
      const imported = await importedThemeIds(context.tx)
      return present(context.scope.storeId, found, imported.has(found.id))
    }),

  create: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ preset: z.enum(THEME_PRESET_IDS), name: z.string().max(50).optional() }))
    .handler(({ context, input }) =>
      libraryErrors(async () =>
        present(
          context.scope.storeId,
          await createThemeFromPreset(context.tx, context.scope.storeId, input),
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
          await updateThemeSettings(context.tx, input.id, input.settings),
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
          await renameTheme(context.tx, input.id, input.name),
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
          await duplicateTheme(context.tx, context.scope.storeId, input.id),
        ),
      ),
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
