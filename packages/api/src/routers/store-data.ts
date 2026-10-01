import { loadEnv } from '@commerce/config'
import {
  deleteConfirmationMatches,
  deleteStore,
  type InStore,
  listStoreExports,
  permissions,
  readStoreExport,
  requestStoreExport,
  runStoreExport,
  STORE_EXPORT_TTL_DAYS,
  type StoreActor,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { can, heavy, type StoreScope } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import { storageProviderFor } from '../services/media.service'
import { getStore } from '../services/store.service'

const env = () => loadEnv(process.env)

type Ctx = ApiContext & {
  tx: StoreTx
  scope: StoreScope
  session: { user: { id: string; email: string } }
}

const actorOf = (context: Ctx): StoreActor => ({
  userId: context.session.user.id,
  email: context.session.user.email,
})

/**
 * The store's current storage plus the local folder (where files were uploaded before a
 * bucket was connected), so closing a store reaches both.
 */
async function storageProviders(context: Ctx): Promise<StorageProvider[]> {
  const { storage } = await storeRegistries(context.tx, context.scope.storeId)
  const current = await storageProviderFor(
    context.tx,
    context.scope.storeId,
    storage,
    env().SETTINGS_SECRET,
  )
  const local = storage.create('local', {})
  return local.ok && local.provider.id !== current.id ? [current, local.provider] : [current]
}

async function currentStorage(context: Ctx): Promise<StorageProvider> {
  const { storage } = await storeRegistries(context.tx, context.scope.storeId)
  return storageProviderFor(context.tx, context.scope.storeId, storage, env().SETTINGS_SECRET)
}

/** The platform's own sales store runs the platform's billing; it is never closed from its admin. */
const isPlatformStore = (storeId: string) => env().PLATFORM_SALES_STORE_ID === storeId

/**
 * Settings → General → "Your store's data": a full export (every table as NDJSON in a zip,
 * built by the worker) and closing the store for good. Exports need `settings.manage`;
 * deleting the store is for the owner only, by definition not a grantable permission
 * (docs/guardrails.md, "Router idiom"), and needs the store's name typed to confirm.
 * Both are on the `storeData` rate limit and both land in the platform audit trail.
 */
export const storeDataRouter = {
  overview: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const s = await getStore(context.tx, context.scope.storeId)
    const canExport = context.scope.can(permissions.SETTINGS_MANAGE)
    return {
      storeName: s?.name ?? '',
      canExport,
      canDelete: context.scope.isOwner && !isPlatformStore(context.scope.storeId),
      /** How many days a finished export stays downloadable. */
      keptDays: STORE_EXPORT_TTL_DAYS,
      exports: canExport ? await listStoreExports(context.tx) : [],
    }
  }),

  requestExport: can(permissions.SETTINGS_MANAGE)
    .use(heavy('storeData'))
    .handler(async ({ context }) => {
      const { storeId } = context.scope
      const { exportId, created } = await requestStoreExport(context.tx, storeId, actorOf(context))
      if (!created) return { exportId }
      if (context.storeExport) {
        await context.storeExport.add(
          'export',
          { storeId, exportId },
          { jobId: `store-export-${exportId}`, attempts: 3, removeOnComplete: true },
        )
        return { exportId }
      }
      // No worker queue (tests, a bare dev host): build it inside this request.
      const inStore: InStore = (fn) => fn(context.tx)
      await runStoreExport(inStore, {
        storeId,
        exportId,
        provider: await currentStorage(context),
        secret: env().SETTINGS_SECRET,
      })
      return { exportId }
    }),

  downloadExport: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const file = await readStoreExport(context.tx, await currentStorage(context), {
        storeId: context.scope.storeId,
        exportId: input.id,
        actor: actorOf(context),
      })
      if (!file) {
        throw new ORPCError('NOT_FOUND', {
          message: 'This download is no longer available. Make a new one.',
        })
      }
      return new File([file.bytes as Uint8Array<ArrayBuffer>], file.filename, {
        type: 'application/zip',
      })
    }),

  deleteStore: can(permissions.SETTINGS_MANAGE)
    .use(heavy('storeData'))
    .input(z.object({ confirm: z.string().max(200) }))
    .handler(async ({ context, input }) => {
      const { storeId } = context.scope
      // Owner only: closing the store is not a grain any other role can be given.
      if (!context.scope.isOwner) {
        throw new ORPCError('FORBIDDEN', { message: 'Only the store owner can delete the store.' })
      }
      if (isPlatformStore(storeId)) {
        throw new ORPCError('FORBIDDEN', { message: 'The platform store cannot be deleted here.' })
      }
      const s = await getStore(context.tx, storeId)
      if (!s || !deleteConfirmationMatches(input.confirm, s.name)) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Type the store name exactly as shown to confirm.',
          data: { reason: 'confirm' },
        })
      }
      const result = await deleteStore(context.tx, {
        storeId,
        actor: actorOf(context),
        providers: await storageProviders(context),
      })
      return { deleted: true as const, ...result }
    }),
}
