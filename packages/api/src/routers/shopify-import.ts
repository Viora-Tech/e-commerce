import { loadEnv, settingsSecret } from '@commerce/config'
import { siteConfig } from '@commerce/config/site'
import {
  enqueueAppJob,
  linkPlatformAccount,
  permissions,
  removeAppJob,
  unlinkPlatformAccount,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  type AppToken,
  ConnectionError,
  CSV_RESOURCES,
  checkInstallCallback,
  connect,
  connectApp,
  connectedShop,
  createApiRun,
  createCsvRun,
  createRemainingRun,
  createRetryRun,
  disconnect,
  exchangeInstallCode,
  failRun,
  getConnection,
  getRun,
  IMPORT_RESOURCES,
  ImportError,
  importStoreSettings,
  importTraffic,
  issueGroups,
  LAUNCH_STORE,
  listIssues,
  listRuns,
  openInstallGrant,
  preflightChecks,
  previewStoreSettings,
  type RunRow,
  remainingStatus,
  requestStop,
  runJobKey,
  SETTINGS_PARTS,
  SHOPIFY_IMPORT_ID,
  ShopifyError,
  ShopifyOAuthError,
  shopifyAppFromEnv,
  shopifyInstallUrl,
  startRun,
  testConnection,
} from '@commerce/plugin-shopify-import/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { can, heavy, PAGE_MAX, PAGE_SIZE_MAX } from '../procedures'
import { getStoreApps, storeRegistries } from '../services/apps.service'
import { storageProviderFor } from '../services/media.service'

type Ctx = ApiContext & { tx: StoreTx; scope: { storeId: string } }

/** Every procedure here needs the store to have installed the app. */
async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(SHOPIFY_IMPORT_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Shopify importer first' })
  }
}

function asOrpc(err: unknown): never {
  if (
    err instanceof ImportError ||
    err instanceof ConnectionError ||
    err instanceof ShopifyError ||
    err instanceof ShopifyOAuthError
  ) {
    throw new ORPCError('BAD_REQUEST', { message: err.message })
  }
  throw err
}

/**
 * Queue the run in the worker. The job id is per start of the run
 * (`runJobKey`), so Try again after a failure gets a fresh job instead of
 * colliding with the failed one BullMQ still keeps, while a double click is
 * refused by `startRun` before it gets here. Without a queue (tests, a broken
 * Redis) the run is marked failed rather than left waiting.
 */
async function queue(context: Ctx, run: Pick<RunRow, 'id' | 'updatedAt'>) {
  if (!context.appJobs) {
    await failRun(context.tx, run.id, 'Background jobs are not available. Try again shortly.')
    return
  }
  await enqueueAppJob(
    context.appJobs,
    {
      storeId: context.scope.storeId,
      pluginId: SHOPIFY_IMPORT_ID,
      name: 'run',
      data: { runId: run.id },
    },
    runJobKey(run),
  )
}

const RunId = z.object({ id: z.uuid() })

/** Shopify importer: CSV uploads, the API connection, and import runs. */
/** Saves the app's token for this store and links the shop as its Shopify account. */
async function connectAppAndLink(tx: StoreTx, storeId: string, shop: string, token: AppToken) {
  const view = await connectApp(tx, storeId, shop, token, settingsSecret())
  await linkPlatformAccount({ tx, storeId }, 'shopify', shop, { shopName: view.shopName ?? '' })
  return view
}

export const shopifyImportRouter = {
  connection: can(permissions.APPS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    return getConnection(context.tx, settingsSecret())
  }),

  connect: can(permissions.APPS_MANAGE)
    .input(
      z
        .object({
          shopDomain: z.string().trim().min(1).max(200),
          accessToken: z.string().trim().min(1).max(200).optional(),
          clientId: z.string().trim().min(1).max(200).optional(),
          clientSecret: z.string().trim().min(1).max(200).optional(),
        })
        .refine((v) => v.accessToken || (v.clientId && v.clientSecret), {
          message: 'Provide an Admin API token, or a client ID and client secret',
        }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const connectInput = input.accessToken
        ? { shopDomain: input.shopDomain, accessToken: input.accessToken }
        : {
            shopDomain: input.shopDomain,
            clientId: input.clientId ?? '',
            clientSecret: input.clientSecret ?? '',
          }
      return connect(context.tx, context.scope.storeId, connectInput, settingsSecret()).catch(
        asOrpc,
      )
    }),

  /** Whether this deployment has the platform's own Shopify app, so "Install the app" can show. */
  appInstall: can(permissions.APPS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    return { available: shopifyAppFromEnv(process.env) !== null }
  }),

  /**
   * "Install the app" (the platform's own Shopify app): the URL on the merchant's shop that asks them to approve the
   * app's read scopes. Shopify sends them back to `/api/apps/shopify-import/oauth/callback`.
   */
  startAppInstall: can(permissions.APPS_MANAGE)
    .input(z.object({ shopDomain: z.string().trim().min(1).max(200) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const app = shopifyAppFromEnv(process.env)
      if (!app)
        throw new ORPCError('PRECONDITION_FAILED', {
          message: `The ${siteConfig.brand.name} Shopify app is not set up on this deployment.`,
        })
      try {
        return {
          url: shopifyInstallUrl(app, {
            shopDomain: input.shopDomain,
            storeId: context.scope.storeId,
            adminUrl: loadEnv(process.env).ADMIN_URL,
            secret: settingsSecret(),
          }),
        }
      } catch (err) {
        return asOrpc(err)
      }
    }),

  /**
   * Shopify's redirect after the merchant approved the app (the callback route passes the
   * whole query): Shopify's hmac, our state for this very store, then the code exchange.
   */
  completeAppInstall: can(permissions.APPS_MANAGE)
    .input(z.object({ callback: z.string().max(4000) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const app = shopifyAppFromEnv(process.env)
      if (!app)
        throw new ORPCError('PRECONDITION_FAILED', {
          message: `The ${siteConfig.brand.name} Shopify app is not set up on this deployment.`,
        })
      try {
        const cb = checkInstallCallback(new URLSearchParams(input.callback), app, settingsSecret())
        // An install Shopify started has no store in its state: it joins the signed-in store.
        if (cb.storeId !== LAUNCH_STORE && cb.storeId !== context.scope.storeId)
          throw new ORPCError('FORBIDDEN', {
            message: 'This install was started for another store.',
          })
        const token = await exchangeInstallCode(app, cb.shop, cb.code)
        return await connectAppAndLink(context.tx, context.scope.storeId, cb.shop, token)
      } catch (err) {
        if (err instanceof ORPCError) throw err
        return asOrpc(err)
      }
    }),

  /**
   * An install Shopify started while signed out: the callback swapped the code and sealed the
   * token into a short-lived cookie; after sign-in the claim route hands it here for this store.
   */
  claimAppInstall: can(permissions.APPS_MANAGE)
    .input(z.object({ grant: z.string().max(8000) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const grant = openInstallGrant(input.grant, settingsSecret())
      if (!grant)
        throw new ORPCError('BAD_REQUEST', {
          message: 'This install link expired. Install the app from Shopify again.',
        })
      try {
        return await connectAppAndLink(context.tx, context.scope.storeId, grant.shop, grant.token)
      } catch (err) {
        return asOrpc(err)
      }
    }),

  /** Shop name plus which of the import's scopes the saved token actually has. */
  testConnection: can(permissions.APPS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    return testConnection(context.tx, settingsSecret()).catch(asOrpc)
  }),

  disconnect: can(permissions.APPS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    const shop = await connectedShop(context.tx)
    await disconnect(context.tx)
    if (shop)
      await unlinkPlatformAccount({ tx: context.tx, storeId: context.scope.storeId }, 'shopify')
    return true
  }),

  /** Upload one Shopify CSV export; the preview runs straight away. */
  createCsvRun: can(permissions.APPS_MANAGE)
    .use(heavy('import'))
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
        settingsSecret(),
      )
      const run = await createCsvRun(context.tx, context.scope.storeId, provider, {
        ...input,
        createdBy: context.session.user.email,
      }).catch(asOrpc)
      await queue(context, run)
      return { id: run.id }
    }),

  /**
   * "Before you import": file storage, Shopify scopes per chosen resource, and what the
   * chosen resources depend on. Shown before Preview import and Import now.
   */
  preflight: can(permissions.APPS_MANAGE)
    .input(
      z.object({
        resources: z.array(z.enum(IMPORT_RESOURCES)).min(1),
        mode: z.enum(['api', 'csv']).default('api'),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      const provider = await storageProviderFor(
        context.tx,
        context.scope.storeId,
        storage,
        settingsSecret(),
      )
      const scopes =
        input.mode === 'api'
          ? await testConnection(context.tx, settingsSecret()).catch((err: unknown) => ({
              error: err instanceof Error ? err.message : String(err),
            }))
          : null
      return preflightChecks(context.tx, {
        mode: input.mode,
        resources: input.resources,
        storage: { providerId: provider.id, production: process.env.NODE_ENV === 'production' },
        scopes,
      })
    }),

  /** Preview an API import of the chosen resources. */
  createApiRun: can(permissions.APPS_MANAGE)
    .use(heavy('import'))
    .input(
      z.object({
        resources: z.array(z.enum(IMPORT_RESOURCES)).min(1),
        includeUnusedFiles: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const connection = await getConnection(context.tx, settingsSecret())
      if (!connection) {
        throw new ORPCError('BAD_REQUEST', { message: 'Connect your Shopify store first' })
      }
      const run = await createApiRun(context.tx, context.scope.storeId, {
        resources: input.resources,
        includeUnusedFiles: input.includeUnusedFiles ?? false,
        createdBy: context.session.user.email,
      }).catch(asOrpc)
      await queue(context, run)
      return { id: run.id }
    }),

  /** Import for real after a preview, or run a finished import again. */
  start: can(permissions.APPS_MANAGE)
    .use(heavy('import'))
    .input(RunId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const run = await startRun(context.tx, input.id).catch(asOrpc)
      await queue(context, run)
      return { id: run.id }
    }),

  /**
   * Stop import: a waiting run is cancelled and its job taken off the queue; a running
   * one stops within seconds (marked stopped after a minute even if its worker hangs).
   * What it imported stays. Same permission as starting one.
   */
  stop: can(permissions.APPS_MANAGE)
    .input(RunId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const user = context.session.user
      const { run, jobKey } = await requestStop(
        context.tx,
        input.id,
        user.name?.trim() || user.email,
      ).catch(asOrpc)
      if (jobKey && context.appJobs) {
        // Best effort: a job that slipped through sees the run stopped and does nothing.
        await removeAppJob(
          context.appJobs,
          { storeId: context.scope.storeId, pluginId: SHOPIFY_IMPORT_ID },
          jobKey,
        ).catch(() => false)
      }
      return { id: run.id, status: run.status }
    }),

  /** "Retry the ones that were missed": a new import of only what this one reported problems for. */
  retryRun: can(permissions.APPS_MANAGE)
    .use(heavy('import'))
    .input(RunId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const run = await createRetryRun(
        context.tx,
        context.scope.storeId,
        input.id,
        context.session.user.email,
      ).catch(asOrpc)
      await queue(context, run)
      return { id: run.id }
    }),

  /**
   * "What is left to import": Shopify's counts (cached a few minutes per store), what is
   * here, and what is missing per resource, plus product images.
   */
  status: can(permissions.APPS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    return remainingStatus(context.tx, context.scope.storeId, settingsSecret())
  }),

  /** Shopify's daily sessions and visitors. Running it again replaces the same days. */
  importTraffic: can(permissions.APPS_MANAGE)
    .use(heavy('import'))
    .handler(async ({ context }) => {
      await requireInstalled(context)
      return importTraffic(context.tx, context.scope.storeId, settingsSecret()).catch(asOrpc)
    }),

  /** "Import remaining": one import that writes only what is missing, for these resources. */
  importRemaining: can(permissions.APPS_MANAGE)
    .use(heavy('import'))
    .input(z.object({ resources: z.array(z.enum(IMPORT_RESOURCES)).min(1) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const run = await createRemainingRun(context.tx, context.scope.storeId, {
        resources: input.resources,
        createdBy: context.session.user.email,
      }).catch(asOrpc)
      await queue(context, run)
      return { id: run.id }
    }),

  /** A run's problems grouped by cause, each with its fix. */
  issueGroups: can(permissions.APPS_MANAGE)
    .input(z.object({ runId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return issueGroups(context.tx, input.runId)
    }),

  runs: can(permissions.APPS_MANAGE)
    .input(
      z.object({
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(20),
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
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(50),
        resource: z.enum(IMPORT_RESOURCES).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return listIssues(context.tx, input)
    }),

  /**
   * Store settings: what each part (store details, tax, locations, shipping, packages,
   * policies, extra field definitions) would change here. Reads Shopify, writes nothing.
   */
  settingsPreview: can(permissions.APPS_MANAGE).handler(async ({ context }) => {
    await requireInstalled(context)
    return previewStoreSettings(context.tx, context.scope.storeId, settingsSecret()).catch(asOrpc)
  }),

  /**
   * Import the chosen store settings parts. Shopify is read again; each part saves on its own
   * and reports created, unchanged, conflicts and what to set up by hand. It changes store
   * settings, so it needs settings.manage. Safe to repeat: a second run changes nothing.
   */
  importSettings: can(permissions.SETTINGS_MANAGE)
    .use(heavy('import'))
    .input(z.object({ parts: z.array(z.enum(SETTINGS_PARTS)).min(1) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return importStoreSettings(
        context.tx,
        context.scope.storeId,
        settingsSecret(),
        input.parts,
      ).catch(asOrpc)
    }),
}
