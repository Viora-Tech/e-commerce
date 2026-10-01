import { settingsSecret } from '@commerce/config'
import {
  confirmUpload,
  createUploadIntent,
  deleteMedia,
  enqueueMediaProcess,
  InvalidUpload,
  listMedia,
  permissions,
  UploadIntentSchema,
  updateMedia,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { storageProviderFor } from '../services/media.service'

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
        fileType: z.enum(['image', 'video']).optional(),
        size: z.enum(['small', 'medium', 'large']).optional(),
        used: z.enum(['used', 'unused']).optional(),
      }),
    )
    .handler(({ context, input }) => listMedia(context.tx, input)),

  update: can(permissions.CONTENT_WRITE)
    .input(z.object({ id: z.uuid(), alt: z.string().trim().max(300).nullable() }))
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
