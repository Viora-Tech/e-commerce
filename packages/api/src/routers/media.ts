import { loadEnv } from '@commerce/config'
import {
  confirmUpload,
  createUploadIntent,
  deleteMedia,
  InvalidUpload,
  listMedia,
  permissions,
  UploadIntentSchema,
  updateMedia,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { storageProviderFor } from '../services/media.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET

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
        secret(),
      )
      try {
        return await createUploadIntent(context.tx, context.scope.storeId, provider, input)
      } catch (err) {
        if (err instanceof InvalidUpload)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  /** Step 2: the PUT succeeded; the file is live. */
  confirm: can(permissions.CONTENT_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        width: z.number().int().min(1).optional(),
        height: z.number().int().min(1).optional(),
      }),
    )
    .handler(({ context, input: { id, ...dims } }) => confirmUpload(context.tx, id, dims)),

  list: can(permissions.CONTENT_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(40),
        search: z.string().trim().max(200).optional(),
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
        secret(),
      )
      await deleteMedia(context.tx, input.id, provider)
      return { ok: true }
    }),
}
