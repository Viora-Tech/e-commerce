import {
  createCodeFile,
  discardCodeDrafts,
  listCodeFiles,
  listCodeFileVersions,
  NEW_FILE_KINDS,
  type NewFileKind,
  permissions,
  publishCodeDrafts,
  readCodeFile,
  readCodeFileVersion,
  saveCodeFile,
} from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { libraryErrors, savedBy } from './theme-helpers'

/** The largest file Edit code saves (Shopify's own limit for a theme file is 256 KB). */
const CODE_FILE_MAX = 256 * 1024

const FileRef = z.object({ themeId: z.string().uuid(), path: z.string().min(1).max(300) })

const NEW_KINDS = Object.keys(NEW_FILE_KINDS) as [NewFileKind, ...NewFileKind[]]

/**
 * Edit code: an imported theme's own files, a native theme's templates and settings as JSON.
 * Saves are checked again here (`saveCodeFile`), so a broken file never reaches the store. An
 * imported theme's saves are drafts until `publish` puts them all live together.
 */
export const themeCodeRouter = {
  files: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ themeId: z.string().uuid() }))
    .handler(({ context, input }) => libraryErrors(() => listCodeFiles(context.tx, input.themeId))),

  read: can(permissions.ONLINE_STORE_READ)
    .input(FileRef)
    .handler(({ context, input }) =>
      libraryErrors(() => readCodeFile(context.tx, input.themeId, input.path)),
    ),

  save: can(permissions.ONLINE_STORE_WRITE)
    .input(FileRef.extend({ body: z.string().max(CODE_FILE_MAX, 'Files can be up to 256 KB') }))
    .handler(({ context, input }) =>
      libraryErrors(() =>
        saveCodeFile(context.tx, context.scope.storeId, { ...input, by: savedBy(context) }),
      ),
    ),

  publish: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ themeId: z.string().uuid() }))
    .handler(({ context, input }) =>
      libraryErrors(() =>
        publishCodeDrafts(context.tx, context.scope.storeId, { ...input, by: savedBy(context) }),
      ),
    ),

  discard: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ themeId: z.string().uuid(), path: z.string().min(1).max(300).optional() }))
    .handler(({ context, input }) => libraryErrors(() => discardCodeDrafts(context.tx, input))),

  create: can(permissions.ONLINE_STORE_WRITE)
    .input(
      z.object({
        themeId: z.string().uuid(),
        kind: z.enum(NEW_KINDS),
        name: z.string().trim().min(1).max(80),
      }),
    )
    .handler(({ context, input }) =>
      libraryErrors(() =>
        createCodeFile(context.tx, context.scope.storeId, { ...input, by: savedBy(context) }),
      ),
    ),

  versions: can(permissions.ONLINE_STORE_READ)
    .input(FileRef)
    .handler(({ context, input }) =>
      libraryErrors(() => listCodeFileVersions(context.tx, input.themeId, input.path)),
    ),

  version: can(permissions.ONLINE_STORE_READ)
    .input(FileRef.extend({ versionId: z.string().uuid() }))
    .handler(({ context, input }) => libraryErrors(() => readCodeFileVersion(context.tx, input))),
}
