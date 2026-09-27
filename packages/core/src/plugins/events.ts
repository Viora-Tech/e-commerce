import { type Db, store, withStore } from '@commerce/db'
import type { TemplateId } from '@commerce/notifications'
import type { AppEvent, AppHookContext, LoadedPlugins } from '@commerce/plugins'
import type { StorageProvider } from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { parseAppsSettings } from '../apps/settings'
import { addMediaProcessJob, type MediaProcessQueue } from '../media/queue'

/** BullMQ queue for app lifecycle events. Braces keep every key on one Redis slot. */
export const APP_EVENTS_QUEUE = '{apps}-events'

export type AppEventJob = {
  storeId: string
  event: AppEvent
  orderId: string
  refundId?: string | undefined
  /**
   * One job per installed app's hook, set by the outbox relay so a failing
   * app retries on its own without re-running any other app's hook or the
   * notification for the same event. Absent only for legacy callers, which
   * still run every hook for the event in one job.
   */
  pluginId?: string | undefined
}

/** The slice of a BullMQ Queue core needs, as with notifications. */
export type AppEventQueue = {
  add(
    name: string,
    data: AppEventJob,
    opts?: {
      jobId?: string
      attempts?: number
      backoff?: { type: 'exponential' | 'fixed'; delay: number }
    },
  ): Promise<unknown>
}

/** One job per order event (or per refund) per app; a repeat enqueue is a no-op. */
export const appEventJobId = (job: AppEventJob): string =>
  `${job.storeId}:${job.event}:${job.refundId ?? job.orderId}${job.pluginId ? `:${job.pluginId}` : ''}`

export async function enqueueAppEvent(queue: AppEventQueue, job: AppEventJob): Promise<void> {
  await queue.add(job.event, job, {
    jobId: appEventJobId(job),
    attempts: 5,
    backoff: { type: 'exponential', delay: 10_000 },
  })
}

/**
 * The lifecycle event a notification stands for. Every path that marks an
 * order paid or shipped already queues these notifications (webhook, client
 * confirm, admin, collect payment), so the notification worker is the one
 * place that turns them into app events without touching each call site.
 */
export function appEventForTemplate(template: TemplateId): AppEvent | null {
  if (template === 'payment_received') return 'order.paid'
  if (template === 'order_shipped') return 'order.fulfilled'
  return null
}

export type DispatchDeps = {
  db: Db
  plugins: LoadedPlugins
  /** Resolves the store's active storage provider inside its transaction. */
  storage: (storeId: string) => Promise<StorageProvider>
  settingsSecret: string
  storefrontUrl: string | null
  log?: ((message: string) => void) | undefined
  /** Sends order emails for `ctx.notify`; the worker wires it to the notification channels. */
  notify?:
    | ((
        storeId: string,
        input: Parameters<AppHookContext['notify']>[0],
      ) => ReturnType<AppHookContext['notify']>)
    | undefined
  /** Backs `ctx.processMedia`; the worker passes its media-processing queue. */
  mediaProcess?: MediaProcessQueue | undefined
}

/**
 * Run every installed app's hook for one event. A hook that throws fails the
 * job so BullMQ retries it; hooks must therefore be idempotent, which the job
 * id already encourages. Apps the store never installed are never called.
 */
export async function installedApps(db: Db, storeId: string): Promise<string[]> {
  return withStore(db, storeId, async (tx) => {
    const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
    return parseAppsSettings(s?.apps).installed
  })
}

/** The context every hook, job and attachment callback receives for one store. */
export function appContext(deps: DispatchDeps, storeId: string, tag: string): AppHookContext {
  const log = deps.log ?? (() => {})
  return {
    storeId,
    inStore: (fn) => withStore(deps.db, storeId, fn),
    storage: () => deps.storage(storeId),
    settingsSecret: deps.settingsSecret,
    storefrontUrl: deps.storefrontUrl,
    log: (message) => log(`[${tag}] ${message}`),
    notify: (input) =>
      deps.notify
        ? deps.notify(storeId, input)
        : Promise.resolve({ sent: 0, errors: ['notifications are not available here'] }),
    ...(deps.mediaProcess
      ? {
          processMedia: (mediaId: string) =>
            addMediaProcessJob(deps.mediaProcess as MediaProcessQueue, { storeId, mediaId }),
        }
      : {}),
  }
}

/**
 * Run every installed app's hook for one event, or (when the outbox relay set
 * `job.pluginId`) just that one app's. Scoping to one app per job means a hook
 * that throws only fails and retries its own job; every other app's hook, run
 * as its own job, already succeeded and is untouched by that retry.
 */
export async function dispatchAppEvent(
  deps: DispatchDeps,
  job: AppEventJob,
): Promise<{ ran: string[] }> {
  const installed = await installedApps(deps.db, job.storeId)
  const allHooks = deps.plugins.hooksFor(job.event, installed)
  const hooks = job.pluginId ? allHooks.filter((h) => h.pluginId === job.pluginId) : allHooks
  const log = deps.log ?? (() => {})
  const ctx = appContext(deps, job.storeId, job.event)
  for (const { pluginId, hook } of hooks) {
    await hook(ctx, { storeId: job.storeId, orderId: job.orderId, refundId: job.refundId })
    log(`[${job.event}] ${pluginId} order=${job.orderId}`)
  }
  return { ran: hooks.map((h) => h.pluginId) }
}

/** BullMQ queue for jobs apps queue for themselves (PDF renders, email batches). */
export const APP_JOBS_QUEUE = '{apps}-jobs'

export type AppJobData = {
  storeId: string
  pluginId: string
  name: string
  data: unknown
}

export type AppJobQueue = {
  add(
    name: string,
    data: AppJobData,
    opts?: {
      jobId?: string
      attempts?: number
      backoff?: { type: 'exponential' | 'fixed'; delay: number }
      removeOnComplete?: boolean | number
    },
  ): Promise<unknown>
}

/**
 * Queue an app job. `dedupeKey` makes a repeat enqueue a no-op while the
 * first is still waiting (e.g. two clicks on Regenerate).
 */
export async function enqueueAppJob(
  queue: AppJobQueue,
  job: AppJobData,
  dedupeKey?: string,
): Promise<void> {
  await queue.add(`${job.pluginId}:${job.name}`, job, {
    // BullMQ allows ':' in a custom id only as exactly three parts.
    ...(dedupeKey
      ? { jobId: `${job.storeId}:${job.pluginId}:${dedupeKey.replace(/:/g, '-')}` }
      : {}),
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: true,
  })
}

/** Run one app job. An app that was uninstalled since the job was queued is skipped. */
export async function dispatchAppJob(
  deps: DispatchDeps,
  job: AppJobData,
): Promise<{ ran: boolean }> {
  const installed = await installedApps(deps.db, job.storeId)
  const run = deps.plugins.jobFor(job.pluginId, job.name, installed)
  if (!run) return { ran: false }
  await run(appContext(deps, job.storeId, `${job.pluginId}:${job.name}`), job.data)
  return { ran: true }
}
