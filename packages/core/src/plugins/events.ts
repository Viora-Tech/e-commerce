import { type Db, store, withStore } from '@commerce/db'
import type { TemplateId } from '@commerce/notifications'
import type { AppEvent, AppHookContext, LoadedPlugins } from '@commerce/plugins'
import type { StorageProvider } from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { recordAppActivity, recordAppError } from '../apps/installation'
import { parseAppsSettings } from '../apps/settings'
import { storefrontOriginFor } from '../domains/origin'
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

/** The queue's job id for an app job queued with `dedupeKey`. */
const appJobId = (storeId: string, pluginId: string, dedupeKey: string) =>
  // BullMQ allows ':' in a custom id only as exactly three parts.
  `${storeId}:${pluginId}:${dedupeKey.replace(/:/g, '-')}`

/**
 * Take a job queued with `dedupeKey` off the queue, if it is still waiting. False
 * when the queue cannot remove jobs or the job already started (or is gone).
 */
export async function removeAppJob(
  queue: AppJobQueue,
  job: { storeId: string; pluginId: string },
  dedupeKey: string,
): Promise<boolean> {
  if (!queue.remove) return false
  const removed = await queue.remove(appJobId(job.storeId, job.pluginId, dedupeKey))
  return removed === 1 || removed === true
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
  /**
   * Platform storefront URL (`STOREFRONT_URL`). `storeAppContext` swaps it for the store's
   * own primary domain; this is only the fallback for a store without one.
   */
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
function appContext(deps: DispatchDeps, storeId: string, tag: string): AppHookContext {
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
          processMedia: (mediaId: string, opts?: { bulk?: boolean }) =>
            addMediaProcessJob(deps.mediaProcess as MediaProcessQueue, {
              storeId,
              mediaId,
              ...(opts?.bulk ? { bulk: true } : {}),
            }),
        }
      : {}),
  }
}

/**
 * `appContext` with `storefrontUrl` set to the store's own origin (its live primary domain,
 * else the platform fallback), so links apps build (e.g. an invoice download in an email)
 * open on a host that serves this store.
 */
export async function storeAppContext(
  deps: DispatchDeps,
  storeId: string,
  tag: string,
): Promise<AppHookContext> {
  const fallback = deps.storefrontUrl
  const storefrontUrl = fallback
    ? await withStore(deps.db, storeId, (tx) => storefrontOriginFor(tx, storeId, fallback))
    : null
  return { ...appContext(deps, storeId, tag), storefrontUrl }
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
  const ctx = await storeAppContext(deps, job.storeId, job.event)
  for (const { pluginId, hook } of hooks) {
    let said: string | null = null
    const reportActivity = (summary: string) => {
      said = summary
    }
    await hook(
      { ...ctx, reportActivity },
      { storeId: job.storeId, orderId: job.orderId, refundId: job.refundId },
    )
    log(`[${job.event}] ${pluginId} order=${job.orderId}`)
    await noteActivity(deps, job.storeId, pluginId, said)
  }
  return { ran: hooks.map((h) => h.pluginId) }
}

/**
 * Record a finished hook or job as the app's last activity. Bookkeeping only: a failure here is
 * logged and never fails (or retries) the work that already succeeded.
 */
async function noteActivity(
  deps: DispatchDeps,
  storeId: string,
  pluginId: string,
  summary: string | null,
): Promise<void> {
  try {
    await withStore(deps.db, storeId, (tx) =>
      recordAppActivity(tx, storeId, pluginId, summary, { clearError: true }),
    )
  } catch (err) {
    deps.log?.(`[${pluginId}] could not record activity: ${String(err)}`)
  }
}

/**
 * An app's hook failed for good (every retry threw): show it as the app's problem on the
 * Installed apps list. Only for per-app jobs; a legacy all-apps job names no one app.
 */
export async function recordAppEventFailure(
  deps: Pick<DispatchDeps, 'db'>,
  job: AppEventJob,
  reason: string,
): Promise<void> {
  const pluginId = job.pluginId
  if (!pluginId) return
  await withStore(deps.db, job.storeId, (tx) => recordAppError(tx, job.storeId, pluginId, reason))
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
  /** Take a waiting or delayed job off the queue (BullMQ `Queue.remove`); 0 when it is running. */
  remove?(jobId: string): Promise<unknown>
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
    ...(dedupeKey ? { jobId: appJobId(job.storeId, job.pluginId, dedupeKey) } : {}),
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
  let said: string | null = null
  const ctx = await storeAppContext(deps, job.storeId, `${job.pluginId}:${job.name}`)
  await run(
    {
      ...ctx,
      reportActivity: (summary) => {
        said = summary
      },
    },
    job.data,
  )
  await noteActivity(deps, job.storeId, job.pluginId, said)
  return { ran: true }
}

/**
 * Tell the app one of its jobs failed for good (last retry threw, or it
 * stalled out because the worker died under it), so it can mark its own
 * record failed instead of leaving a page waiting forever.
 */
export async function dispatchAppJobFailure(
  deps: DispatchDeps,
  job: AppJobData,
  reason: string,
): Promise<{ ran: boolean }> {
  const installed = await installedApps(deps.db, job.storeId)
  if (installed.includes(job.pluginId)) {
    await withStore(deps.db, job.storeId, (tx) =>
      recordAppError(tx, job.storeId, job.pluginId, reason),
    ).catch((err) => deps.log?.(`[${job.pluginId}] could not record failure: ${String(err)}`))
  }
  const onFailed = deps.plugins.jobFailedFor(job.pluginId, job.name, installed)
  if (!onFailed) return { ran: false }
  await onFailed(
    await storeAppContext(deps, job.storeId, `${job.pluginId}:${job.name}:failed`),
    job.data,
    reason,
  )
  return { ran: true }
}

/**
 * Whether a failed BullMQ job will not run again: every attempt is spent, or
 * it stalled out (the process holding it died more often than allowed, which
 * BullMQ fails without retrying).
 */
export function isFinalJobFailure(
  job: { attemptsMade: number; opts: { attempts?: number | undefined } },
  error: { message: string } | undefined,
): boolean {
  if (error && /stalled more than allowable limit/i.test(error.message)) return true
  return job.attemptsMade >= (job.opts.attempts ?? 1)
}
