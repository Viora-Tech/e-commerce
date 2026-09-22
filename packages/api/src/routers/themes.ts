import { loadEnv } from '@commerce/config'
import {
  commitTemplateDrafts,
  createTemplateAlternate,
  createThemeFromPreset,
  deleteTemplateAlternate,
  deleteTheme,
  discardTemplateDrafts,
  duplicateTheme,
  ensureMainTheme,
  getTheme,
  listTemplates,
  listThemes,
  loadTemplate,
  permissions,
  publishTheme,
  renameTheme,
  SECTION_GROUPS,
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
import { themePreviewContext } from '../services/theme-preview.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET
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
    .handler(async ({ context, input }) => ({
      saved: await commitTemplateDrafts(context.tx, input.themeId),
    })),

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
function present(storeId: string, t: ThemeRecord) {
  return {
    ...t,
    previewToken: signThemePreviewToken({ secret: secret(), storeId, themeId: t.id }),
  }
}

/** Online Store › Themes: the library, Shopify style. One theme is live (`main`). */
export const themesRouter = {
  templates: templatesRouter,

  list: can(permissions.ONLINE_STORE_READ).handler(async ({ context }) => {
    const { storeId } = context.scope
    await ensureMainTheme(context.tx, storeId)
    const themes = await listThemes(context.tx)
    return themes.map((t) => present(storeId, t))
  }),

  get: can(permissions.ONLINE_STORE_READ)
    .input(IdInput)
    .handler(async ({ context, input }) => {
      const found = await getTheme(context.tx, input.id)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Theme not found' })
      return present(context.scope.storeId, found)
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
        present(
          context.scope.storeId,
          await updateThemeSettings(context.tx, input.id, input.settings),
        ),
      ),
    ),

  rename: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ id: z.string().uuid(), name: z.string().max(80) }))
    .handler(({ context, input }) =>
      libraryErrors(async () =>
        present(context.scope.storeId, await renameTheme(context.tx, input.id, input.name)),
      ),
    ),

  duplicate: can(permissions.ONLINE_STORE_WRITE)
    .input(IdInput)
    .handler(({ context, input }) =>
      libraryErrors(async () =>
        present(
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
        present(context.scope.storeId, await publishTheme(context.tx, input.id)),
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
