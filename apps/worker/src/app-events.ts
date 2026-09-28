import {
  APP_EVENTS_QUEUE,
  APP_JOBS_QUEUE,
  type AppEventJob,
  type AppJobData,
  appContext,
  type DispatchDeps,
  deliverNotification,
  dispatchAppEvent,
  dispatchAppJob,
  installedApps,
  storageForStore,
} from '@commerce/core'
import { getRegistries, registriesForStore } from '@commerce/core/registries'
import { type Db, withStore } from '@commerce/db'
import type { Attachment, TemplateId } from '@commerce/notifications'
import { type IORedis, type MediaProcessQueue, Worker } from '@commerce/queue'

type AppOpts = {
  settingsSecret: string
  storefrontUrl?: string | undefined
  /** Lets app jobs (the Shopify importer) queue the images they store for processing. */
  mediaProcess?: MediaProcessQueue | undefined
}

/** Everything app hooks and jobs need, resolved per store on demand. */
export function appDeps(db: Db, opts: AppOpts): DispatchDeps {
  return {
    db,
    plugins: getRegistries(),
    settingsSecret: opts.settingsSecret,
    storefrontUrl: opts.storefrontUrl ?? null,
    mediaProcess: opts.mediaProcess,
    storage: (storeId) =>
      withStore(db, storeId, async (tx) =>
        storageForStore(
          tx,
          storeId,
          (await registriesForStore(tx, storeId)).storage,
          opts.settingsSecret,
        ),
      ),
    log: (message) => console.log(`[app] ${message}`),
    notify: async (storeId, input) => {
      const results = await withStore(db, storeId, async (tx) =>
        deliverNotification(
          { storeId, tx },
          { orderId: input.orderId, template: input.template },
          {
            registry: (await registriesForStore(tx, storeId)).notifications,
            settingsSecret: opts.settingsSecret,
            storefrontUrl: opts.storefrontUrl,
            resend: true,
            requires: 'email',
            data: { documentLabel: input.documentLabel, links: input.links },
            extras: async () => ({
              links: input.links ?? [],
              attachments: input.attachments ?? [],
            }),
          },
        ),
      )
      return {
        sent: results.filter((r) => r.ok).length,
        errors: results.flatMap((r) => (r.ok ? [] : [`${r.to}: ${r.error}`])),
      }
    },
  }
}

/**
 * Runs installed apps' lifecycle hooks (`order.paid`, `order.fulfilled`,
 * `refund.created`). A hook that throws fails the job so BullMQ retries with
 * backoff; hooks are idempotent, so a retry after a partial run is safe.
 */
export function createAppEventWorker(connection: IORedis, db: Db, opts: AppOpts) {
  const deps = appDeps(db, opts)
  return new Worker<AppEventJob>(
    APP_EVENTS_QUEUE,
    async (job) => dispatchAppEvent(deps, job.data),
    {
      connection,
      concurrency: 3,
    },
  )
}

/** Runs jobs apps queued for themselves: PDF renders, email batches. */
export function createAppJobWorker(connection: IORedis, db: Db, opts: AppOpts) {
  const deps = appDeps(db, opts)
  return new Worker<AppJobData>(APP_JOBS_QUEUE, async (job) => dispatchAppJob(deps, job.data), {
    connection,
    concurrency: 3,
  })
}

/** Links and attachments installed apps add to one order email. */
export function appEmailExtras(db: Db, opts: AppOpts, storeId: string) {
  const deps = appDeps(db, opts)
  return async (input: { orderId: string; template: TemplateId }) => {
    const installed = await installedApps(db, storeId)
    if (installed.length === 0) return { links: [], attachments: [] as Attachment[] }
    const ctx = appContext(deps, storeId, `email:${input.template}`)
    const [links, attachments] = await Promise.all([
      deps.plugins.orderLinks(installed, { ...ctx, surface: 'email' }, input.orderId),
      deps.plugins.emailAttachments(installed, ctx, input),
    ])
    return { links, attachments }
  }
}
