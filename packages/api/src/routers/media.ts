import { settingsSecret } from '@commerce/config'
import {
  backgroundWork,
  confirmUpload,
  createMediaFolder,
  createUploadIntent,
  deleteMedia,
  deleteMediaFolder,
  enqueueMediaProcess,
  getMedia,
  InvalidUpload,
  listMedia,
  listMediaFolders,
  MediaFolderError,
  MediaFolderNameSchema,
  MOVE_MEDIA_MAX,
  mediaBacklog,
  mediaNeighbours,
  mediaUsage,
  mediaUsedIn,
  moveMediaToFolder,
  onPlatformStorage,
  permissions,
  renameMediaFolder,
  storageRoom,
  UploadIntentSchema,
  updateMedia,
} from '@commerce/core'
import { importInProgress } from '@commerce/plugin-shopify-import/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { loadStorageSettings, storageProviderFor } from '../services/media.service'

/** A folder refusal in plain words: missing → 404, taken name or a folder with files → 400. */
async function folderCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof MediaFolderError) {
      const code = err.code === 'MEDIA_FOLDER_NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST'
      throw new ORPCError(code, { message: err.message, data: { reason: err.code } })
    }
    throw err
  }
}

export const mediaRouter = {
  /** Step 1 of an upload: reserve the row and get a presigned request for the browser. */
  presign: can(permissions.CONTENT_WRITE)
    .input(UploadIntentSchema)
    .handler(async ({ context, input }) => {
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      const provider = await storageProviderFor(
        context.tx,
        context.scope.storeId,
        storage,
        settingsSecret(),
      )
      // Files already stored are never touched; only a new upload past the plan's GB is
      // refused, and only on the platform's bucket (one the merchant connected is theirs).
      const settings = await loadStorageSettings(context.tx, context.scope.storeId)
      if (onPlatformStorage(settings, process.env)) {
        const room = await storageRoom(context.tx, context.scope.storeId)
        if (room.limitBytes !== null && room.usedBytes + input.size > room.limitBytes) {
          throw new ORPCError('FORBIDDEN', {
            message: `Your plan includes ${room.limitBytes / 1024 ** 3} GB of file storage, and it is full.`,
            data: { reason: 'storage_limit', ...room },
          })
        }
      }
      try {
        return await createUploadIntent(context.tx, context.scope.storeId, provider, input)
      } catch (err) {
        if (err instanceof InvalidUpload)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  /**
   * Step 2: the PUT succeeded; the object is HEAD-checked for its real size
   * (see `confirmUpload`). An image row comes back `processing` — the
   * upload-time pipeline (worker) still has to run before it is usable
   * anywhere — so this is also where that job gets queued.
   */
  confirm: can(permissions.CONTENT_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        width: z.number().int().min(1).optional(),
        height: z.number().int().min(1).optional(),
      }),
    )
    .handler(async ({ context, input: { id, ...dims } }) => {
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      const provider = await storageProviderFor(
        context.tx,
        context.scope.storeId,
        storage,
        settingsSecret(),
      )
      try {
        const row = await confirmUpload(context.tx, id, provider, dims)
        if (row.status === 'processing' && context.mediaProcess) {
          await enqueueMediaProcess(context.mediaProcess, {
            storeId: context.scope.storeId,
            mediaId: row.id,
          })
        }
        return row
      } catch (err) {
        if (err instanceof InvalidUpload)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  list: can(permissions.CONTENT_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(40),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        sort: z.enum(['newest', 'oldest', 'name', 'size']).optional(),
        fileType: z.enum(['image', 'video', 'document']).optional(),
        size: z.enum(['small', 'medium', 'large']).optional(),
        used: z.enum(['used', 'unused']).optional(),
        /** Only this folder's files (#91). */
        folderId: z.uuid().optional(),
      }),
    )
    .handler(({ context, input }) => listMedia(context.tx, input)),

  /** Files folders with their file counts (#91). */
  folders: can(permissions.CONTENT_READ).handler(({ context }) => listMediaFolders(context.tx)),

  createFolder: can(permissions.CONTENT_WRITE)
    .input(z.object({ name: MediaFolderNameSchema }))
    .handler(({ context, input }) =>
      folderCall(() => createMediaFolder(context.tx, context.scope.storeId, input.name)),
    ),

  renameFolder: can(permissions.CONTENT_WRITE)
    .input(z.object({ id: z.uuid(), name: MediaFolderNameSchema }))
    .handler(({ context, input }) =>
      folderCall(() => renameMediaFolder(context.tx, input.id, input.name)),
    ),

  /** Only an empty folder; one with files is refused with how many. */
  deleteFolder: can(permissions.CONTENT_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => folderCall(() => deleteMediaFolder(context.tx, input.id))),

  /** Moves files into a folder, or out of any with `folderId` null. */
  moveToFolder: can(permissions.CONTENT_WRITE)
    .input(
      z.object({
        ids: z.array(z.uuid()).min(1).max(MOVE_MEDIA_MAX),
        folderId: z.uuid().nullable(),
      }),
    )
    .handler(({ context, input }) =>
      folderCall(() => moveMediaToFolder(context.tx, input.ids, input.folderId)),
    ),

  usage: can(permissions.CONTENT_READ).handler(({ context }) => mediaUsage(context.tx)),
  /** Images still processing and a running import: the "store may be slower" notice. */
  backgroundWork: can(permissions.CONTENT_READ).handler(async ({ context }) =>
    backgroundWork(await mediaBacklog(context.tx), await importInProgress(context.tx)),
  ),

  /** One file for its page in the library. */
  get: can(permissions.CONTENT_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const row = await getMedia(context.tx, input.id)
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'This file was not found' })
      return row
    }),

  /** The files before and after one in the library's order, for the file page's arrows. */
  neighbours: can(permissions.CONTENT_READ)
    .input(
      z.object({
        id: z.uuid(),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        fileType: z.enum(['image', 'video', 'document']).optional(),
      }),
    )
    .handler(({ context, input: { id, ...filters } }) => mediaNeighbours(context.tx, id, filters)),

  /** The products using one file, for the file page. */
  usedIn: can(permissions.CONTENT_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => mediaUsedIn(context.tx, input.id)),

  update: can(permissions.CONTENT_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        alt: z.string().trim().max(300).nullable().optional(),
        /** Display name in Files (#91); null goes back to the name read from the key. */
        name: z.string().trim().max(120).nullable().optional(),
      }),
    )
    .handler(({ context, input: { id, ...patch } }) => updateMedia(context.tx, id, patch)),

  delete: can(permissions.CONTENT_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      const provider = await storageProviderFor(
        context.tx,
        context.scope.storeId,
        storage,
        settingsSecret(),
      )
      await deleteMedia(context.tx, input.id, provider)
      return { ok: true }
    }),
}
