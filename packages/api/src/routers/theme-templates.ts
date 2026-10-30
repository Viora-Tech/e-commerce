import {
  ALTERNATE_KINDS,
  commitTemplateDrafts,
  createTemplateAlternate,
  deleteCustomSection,
  deleteTemplateAlternate,
  discardTemplateDrafts,
  getTheme,
  listCustomSections,
  listTemplates,
  liveThemeId,
  loadLoopCatalog,
  loadLoopValues,
  loadSourceCatalog,
  loadSourceValues,
  loadTemplate,
  permissions,
  previewCollectionProducts,
  queueThemeScreenshot,
  renameCustomSection,
  renameTemplateAlternate,
  SECTION_GROUPS,
  SETTING_KINDS,
  saveCustomSection,
  saveTemplateDraft,
  snapshotTheme,
  TEMPLATE_KINDS,
  TEMPLATE_SUFFIX,
  templateAssignments,
  touchTheme,
} from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { themePreviewContext } from '../services/theme-preview.service'
import { IdInput, libraryErrors, savedBy } from './theme-helpers'

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
export const templatesRouter = {
  /** What the Customize preview needs to draw the header and footer as the storefront does. */
  previewContext: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    themePreviewContext(context.tx, context.scope.storeId),
  ),

  list: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ themeId: z.string().uuid() }))
    .handler(({ context, input }) => listTemplates(context.tx, input.themeId)),

  /** The live theme's templates (a product's or collection's template picker), in one call. */
  live: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
    const themeId = await liveThemeId(context.tx)
    return themeId ? listTemplates(context.tx, themeId) : []
  }),

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
        if (saved > 0) {
          await touchTheme(context.tx, input.themeId, savedBy(context))
          await queueThemeScreenshot(context.themeScreenshots, {
            storeId: context.scope.storeId,
            themeId: input.themeId,
          })
          // Saving the live theme is what shoppers see next: remember it in the history.
          const current = await getTheme(context.tx, input.themeId)
          if (current?.role === 'main') {
            await snapshotTheme(context.tx, context.scope.storeId, {
              themeId: input.themeId,
              reason: 'save',
              by: savedBy(context),
            })
          }
        }
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

  /** How many products, collections, pages, blogs and posts use each alternate (store-wide). */
  assignments: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    templateAssignments(context.tx),
  ),

  /** Renames an alternate of this theme; resources assigned to it follow (`moved`). */
  rename: can(permissions.ONLINE_STORE_WRITE)
    .input(
      z.object({
        themeId: z.string().uuid(),
        template: z.enum(ALTERNATE_KINDS),
        from: z.string().regex(TEMPLATE_SUFFIX),
        to: z.string().regex(TEMPLATE_SUFFIX),
      }),
    )
    .handler(({ context, input }) =>
      libraryErrors(async () => ({ moved: await renameTemplateAlternate(context.tx, input) })),
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
export const customSectionsRouter = {
  /**
   * The saved sections. With `themeId` (Customize), only those that theme can render: a section
   * holding an imported Shopify section stays with its theme (`customSectionsForTheme`).
   */
  list: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ themeId: z.string().uuid().optional() }).optional())
    .handler(({ context, input }) =>
      listCustomSections(context.tx, context.scope.storeId, input?.themeId),
    ),

  save: can(permissions.ONLINE_STORE_WRITE)
    .input(
      z.object({
        name: z.string().max(200),
        /** The theme being edited; kept on the entry only when the section holds Liquid. */
        themeId: z.string().uuid().optional(),
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
