import {
  createDokployClient,
  createDomainProvider,
  type DokployConfig,
  type DomainRouteJob,
  type DomainTargets,
  markDomainRouteFailed,
  pollPendingDomains,
  type RouteGuard,
  runDomainRouteJob,
} from '@commerce/core'
import type { Db } from '@commerce/db'
import {
  DOMAIN_ROUTE_QUEUE,
  DOMAIN_VERIFY_QUEUE,
  type IORedis,
  Queue,
  Worker,
} from '@commerce/queue'

/** How often domains in flight are checked. DNS changes usually land within minutes. */
export const VERIFY_EVERY_MS = 2 * 60_000

/**
 * One repeat job checks every custom domain still waiting on DNS or on its
 * certificate, store by store. Shopify polls the same way, so a merchant who
 * adds the records and walks away still ends up connected. With Dokploy
 * configured it also queues the HTTPS route for a live domain that has none yet.
 */
export function createDomainPoller(
  connection: IORedis,
  db: Db,
  opts: { provider: string; targets: DomainTargets; requestRoutes: boolean },
) {
  const queue = new Queue(DOMAIN_VERIFY_QUEUE, { connection })
  const provider = createDomainProvider(opts.provider)
  const worker = new Worker(
    DOMAIN_VERIFY_QUEUE,
    async () => {
      const r = await pollPendingDomains(db, {
        provider,
        targets: opts.targets,
        requestRoutes: opts.requestRoutes,
        log: (m) => console.warn(m),
      })
      if (r.checked > 0 || r.failed > 0) {
        console.log(
          `[domains] checked ${r.checked} in ${r.stores} stores, ${r.failed} failed, ${r.routes} routes requested`,
        )
      }
      return r
    },
    { connection },
  )
  return { queue, worker }
}

/**
 * Adds and deletes custom domains' HTTPS routes on the storefront app in Dokploy, one job
 * at a time (`runDomainRouteJob`). Jobs come from the outbox relay with retries; a job that
 * uses them all marks its domain `failed` and the poll asks again later. `dokploy` null
 * (env unset): every job is a no-op.
 */
export function createDomainRouteWorker(
  connection: IORedis,
  db: Db,
  opts: { dokploy: DokployConfig | null; guard: RouteGuard },
) {
  const queue = new Queue<DomainRouteJob>(DOMAIN_ROUTE_QUEUE, { connection })
  const deps = {
    db,
    client: opts.dokploy ? createDokployClient(opts.dokploy) : null,
    guard: opts.guard,
    log: (m: string) => console.log(m),
  }
  const worker = new Worker<DomainRouteJob>(
    DOMAIN_ROUTE_QUEUE,
    (job) => runDomainRouteJob(deps, job.data),
    { connection, concurrency: 1 },
  )
  worker.on('failed', (job, err) => {
    if (!job) return
    const target = job.data.action === 'add' ? job.data.domainId : job.data.hostname
    console.warn(`[domains] route ${job.data.action} ${target} failed: ${err.message}`)
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      markDomainRouteFailed(db, job.data).catch((e: unknown) =>
        console.warn('[domains] could not mark the route failed:', e),
      )
    }
  })
  return { queue, worker }
}
