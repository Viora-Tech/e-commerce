import { loadEnv } from '@commerce/config'
import {
  createThemeFromPreset,
  deleteTheme,
  duplicateTheme,
  ensureMainTheme,
  getTheme,
  listThemes,
  permissions,
  publishTheme,
  renameTheme,
  signThemePreviewToken,
  THEME_PRESET_IDS,
  ThemeLibraryError,
  type ThemeRecord,
  ThemeSchema,
  updateThemeSettings,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

const secret = () => loadEnv(process.env).SETTINGS_SECRET
const IdInput = z.object({ id: z.string().uuid() })

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
