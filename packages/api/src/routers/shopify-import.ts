import { loadEnv } from '@commerce/config'
import { enqueueAppJob, permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  ConnectionError,
  CSV_RESOURCES,
  connect,
  createApiRun,
  createCsvRun,
  disconnect,
  failRun,
  getConnection,
  getRun,
  IMPORT_RESOURCES,
  ImportError,
  listIssues,
  listRuns,
  SHOPIFY_IMPORT_ID,
  ShopifyError,
  startRun,
} from '@commerce/plugin-shopify-import/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { can } from '../procedures'
import { getStoreApps, storeRegistries } from '../services/apps.service'
import { storageProviderFor } from '../services/media.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET

type Ctx = ApiContext & { tx: StoreTx; scope: { storeId: string } }

/** Every procedure here needs the store to have installed the app. */
async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(SHOPIFY_IMPORT_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Shopify importer first' })
  }
}

function asOrpc(err: unknown): never {
  if (err instanceof ImportError || err instanceof ConnectionError || err instanceof ShopifyError) {
    throw new ORPCError('BAD_REQUEST', { message: err.message })
  }
  throw err
}

/**
 * Queue the run in the worker. The job id is per run, so a double click queues
 * it once; without a queue (tests, a broken Redis) the run is marked failed
 * rather than left waiting.
 */
async function queue(context: Ctx, runId: string) {
  if (!context.appJobs) {
    await failRun(context.tx, runId, 'Background jobs are not available. Try again shortly.')
    return
  }
  await enqueueAppJob(
    context.appJobs,
    { storeId: context.scope.storeId, pluginId: SHOPIFY_IMPORT_ID, name: 'run', data: { runId } },
    `run-${runId}`,
  )
}

const RunId = z.object({ id: z.uuid() })

/** Shopify importer: CSV uploads, the API connection, and import runs. */
export const shopifyImportRouter = {
  connection: can(permissions.APPS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    return getConnection(context.tx, secret())
  }),

  connect: can(permissions.APPS_MANAGE)
    .input(
      z.object({
        shopDomain: z.string().trim().min(1).max(200),
        accessToken: z.string().trim().min(1).max(200),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return connect(context.tx, context.scope.storeId, input, secret()).catch(asOrpc)
    }),

  disconnect: can(permissions.APPS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    await disconnect(context.tx)
    return true
  }),

  /** Upload one Shopify CSV export; the preview runs straight away. */
  createCsvRun: can(permissions.APPS_MANAGE)
    .input(
      z.object({
        resource: z.enum(CSV_RESOURCES),
        fileName: z.string().trim().min(1).max(200),
        csv: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      const provider = await storageProviderFor(
        context.tx,
        context.scope.storeId,
        storage,
        secret(),
      )
      const run = await createCsvRun(context.tx, context.scope.storeId, provider, {
        ...input,
        createdBy: context.session.user.email,
      }).catch(asOrpc)
      await queue(context, run.id)
      return { id: run.id }
    }),

  /** Preview an API import of the chosen resources. */
  createApiRun: can(permissions.APPS_MANAGE)
    .input(z.object({ resources: z.array(z.enum(IMPORT_RESOURCES)).min(1) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const connection = await getConnection(context.tx, secret())
      if (!connection) {
        throw new ORPCError('BAD_REQUEST', { message: 'Connect your Shopify store first' })
      }
      const run = await createApiRun(context.tx, context.scope.storeId, {
        resources: input.resources,
        createdBy: context.session.user.email,
      }).catch(asOrpc)
      await queue(context, run.id)
      return { id: run.id }
    }),

  /** Import for real after a preview, or run a finished import again. */
  start: can(permissions.APPS_MANAGE)
    .input(RunId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const run = await startRun(context.tx, input.id).catch(asOrpc)
      await queue(context, run.id)
      return { id: run.id }
    }),

  runs: can(permissions.APPS_MANAGE)
    .input(
      z.object({
        page: z.number().int().min(1).max(10_000).default(1),
        perPage: z.number().int().min(1).max(100).default(20),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return listRuns(context.tx, input)
    }),

  run: can(permissions.APPS_MANAGE)
    .input(RunId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return getRun(context.tx, input.id)
    }),

  issues: can(permissions.APPS_MANAGE)
    .input(
      z.object({
        runId: z.uuid(),
        page: z.number().int().min(1).max(10_000).default(1),
        perPage: z.number().int().min(1).max(100).default(50),
        resource: z.enum(IMPORT_RESOURCES).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return listIssues(context.tx, input)
    }),
}
