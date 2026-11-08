import * as dns from 'node:dns/promises'
import {
  type CertificateDeps,
  type CloudflareConfig,
  createCloudflareClient,
  createDokployClient,
  createDomainProvider,
  type DokployConfig,
  type DomainRouteJob,
  type DomainTargets,
  markDomainRouteFailed,
  pollPendingDomains,
  type RouteGuard,
  recheckAfterSettle,
  runCertificateSweep,
  runDomainRouteJob,
  tlsCertState,
} from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { DOMAIN_ROUTE_QUEUE, type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

/** How often the certificate sweep looks for due hosts; each host's own schedule is in `certCheckInterval`. */
export const CERTIFICATE_EVERY_MS = 60_000

/** How often domains in flight are checked. DNS changes usually land within minutes. */
export const VERIFY_EVERY_MS = 2 * 60_000

/**
 * One repeat job checks every custom domain still waiting on DNS or on its
 * certificate, store by store. Shopify polls the same way, so a merchant who
 * adds the records and walks away still ends up connected. With Dokploy
 * configured it also queues the HTTPS route for a live domain that has none yet.
 */
export function createDomainPoller(
  db: Db,
  opts: {
    provider: string
    cloudflare: CloudflareConfig | null
    targets: DomainTargets
    requestRoutes: boolean
  },
) {
  const provider = createDomainProvider(opts.provider, {
    cloudflare: opts.cloudflare,
    log: (m) => logger.warn(m, { area: 'domains' }),
  })
  const run = async () => {
    const r = await pollPendingDomains(db, {
      provider,
      targets: opts.targets,
      requestRoutes: opts.requestRoutes,
      log: (m) => logger.warn(m, { area: 'domains' }),
    })
    if (r.checked > 0 || r.failed > 0) logger.info('domains checked', { area: 'domains', ...r })
    return r
  }
  return { run }
}

/**
 * Adds and deletes custom domains' HTTPS routes on the storefront app in Dokploy, one job
 * at a time (`runDomainRouteJob`). Jobs come from the outbox relay with retries; a job that
 * uses them all marks its domain `failed` and the poll asks again later. `dokploy` null
 * (env unset): every job is a no-op. `cloudflare` set: a removed domain also leaves Cloudflare.
 */
export function createDomainRouteWorker(
  connection: IORedis,
  db: Db,
  opts: {
    dokploy: DokployConfig | null
    cloudflare: CloudflareConfig | null
    guard: RouteGuard
    targets: DomainTargets
  },
) {
  const queue = new Queue<DomainRouteJob>(DOMAIN_ROUTE_QUEUE, { connection })
  const client = opts.dokploy ? createDokployClient(opts.dokploy) : null
  const hostnames = opts.cloudflare ? createCloudflareClient(opts.cloudflare) : null
  const certificate = certificateDeps(db, client, opts)
  const deps = {
    db,
    client,
    releaseEdgeHostname: hostnames
      ? async (hostname: string) => {
          const found = await hostnames.find(hostname)
          if (found) await hostnames.remove(found.id)
        }
      : undefined,
    guard: opts.guard,
    log: (m: string) => logger.info(m, { area: 'domains' }),
    // "Retry certificate": after the forced re-register, wait for Traefik and record the result.
    afterReregister: async (storeId: string, domainId: string) => {
      await recheckAfterSettle(certificate, storeId, domainId)
    },
  }
  const worker = new Worker<DomainRouteJob>(
    DOMAIN_ROUTE_QUEUE,
    (job) => runDomainRouteJob(deps, job.data),
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  worker.on('failed', (job, err) => {
    if (!job) return
    const target = job.data.action === 'add' ? job.data.domainId : job.data.hostname
    logger.warn('domain route failed', {
      area: 'domains',
      storeId: job.data.storeId,
      action: job.data.action,
      target,
      error: err,
    })
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      markDomainRouteFailed(db, job.data).catch((e: unknown) =>
        logger.warn('could not mark the domain route failed', { area: 'domains', error: e }),
      )
    }
  })
  return { queue, worker }
}

function certificateDeps(
  db: Db,
  client: ReturnType<typeof createDokployClient> | null,
  opts: { guard: RouteGuard; targets: DomainTargets },
): CertificateDeps {
  return {
    db,
    client,
    guard: opts.guard,
    targets: opts.targets,
    tlsCheck: (host) => tlsCertState(host),
    resolver: dns,
    log: (m) => logger.info(m, { area: 'domains' }),
  }
}

/**
 * One repeat job checks every registered store address and custom domain over TLS: a host that
 * still has Traefik's default certificate is re-registered in Dokploy once its DNS points here,
 * on a backoff (`runCertificateSweep`). Only worth running with a real provider; without one
 * there is no real network to ask. Rows Cloudflare took on are skipped row by row.
 */
export function createCertificateSweep(
  db: Db,
  opts: { dokploy: DokployConfig | null; guard: RouteGuard; targets: DomainTargets },
) {
  const deps = certificateDeps(db, opts.dokploy ? createDokployClient(opts.dokploy) : null, opts)
  const run = async () => {
    const r = await runCertificateSweep(deps)
    if (r.checked > 0 || r.failed > 0)
      logger.info('certificates checked', { area: 'domains', ...r })
    return r
  }
  return { run }
}
