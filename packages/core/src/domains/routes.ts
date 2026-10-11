/** SOURCE OF TRUTH: automatic HTTPS routes for custom domains — WHAT: add a verified custom domain to the storefront app in Dokploy (https, Let's Encrypt, path /) and delete it on removal / WHY: Traefik only routes and certifies hostnames it was told about, so domains never went live without a hand-added route */

/*
 * Flow: the worker's domain poll sees a live domain without a working certificate and asks
 * for a route (`requestDomainRoute`: `route_status = 'pending'` plus a
 * `domain.route_requested` outbox row, one transaction). The outbox relay turns that row into
 * a `{domains}-route` job with retries; the job (`runDomainRouteJob`) adds the Dokploy domain
 * unless it is already there and marks the row `ready`. Traefik then gets the certificate and
 * the next poll's TLS check moves the domain to SSL active. `removeDomain` writes
 * `domain.route_removed`, whose job deletes the Dokploy domain. Admin requests never call
 * Dokploy, so Dokploy being down never breaks them.
 */
import { type Db, resolveStore, type StoreTx, storeDomain, withStore } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { insertOutboxEvent } from '../outbox/write'
import type { DokployClient } from './dokploy'
import { isPlatformHostname, normaliseHostname } from './hostname'

type DomainRow = typeof storeDomain.$inferSelect

export type DomainRouteJob =
  | { action: 'add'; storeId: string; domainId: string }
  | { action: 'remove'; storeId: string; hostname: string }

/** The `{domains}-route` queue as the outbox relay sees it (BullMQ's `Queue#add`). */
export type DomainRouteQueue = {
  add(
    name: string,
    data: DomainRouteJob,
    opts?: {
      jobId?: string
      attempts?: number
      backoff?: { type: 'exponential' | 'fixed'; delay: number }
    },
  ): Promise<unknown>
}

/** Retries per job: 30 s, 1, 2, 4, 8 min apart. After that the next poll asks again. */
export const ROUTE_JOB_ATTEMPTS = 6
export const ROUTE_JOB_BACKOFF_MS = 30_000

/**
 * How long a route request may sit without the certificate showing up before the poll asks
 * again: a request lost on the way, a job that gave up, or a route someone deleted in
 * Dokploy. Asking again is safe, the job only adds what is missing.
 */
export const ROUTE_RETRY_MS = 30 * 60_000

/** What may never reach the proxy as a merchant route. */
export type RouteGuard = {
  platformRoots: readonly string[]
  cnameTarget: string
  /** `PLATFORM_STORE_DOMAIN`: the one parent a platform (store address) route may sit under. */
  storeDomain?: string | undefined
}

/**
 * True only for a hostname that passes the same rules `connectDomain` applied (already
 * normalised, a real domain name) and is not one of the platform's own. Checked again right
 * before every Dokploy call, so a bad row can never add or delete a platform route.
 */
export function isRoutableHostname(hostname: string, guard: RouteGuard): boolean {
  const parsed = normaliseHostname(hostname)
  if (!parsed.ok || parsed.hostname !== hostname) return false
  if (isPlatformHostname(hostname, guard.platformRoots)) return false
  return hostname !== guard.cnameTarget.trim().toLowerCase()
}

/** A store address: exactly one DNS label under the store domain, e.g. `asha.example.com`. */
function isStoreAddressHostname(hostname: string, guard: RouteGuard): boolean {
  const parent = guard.storeDomain?.trim().toLowerCase()
  if (!parent || !hostname.endsWith(`.${parent}`)) return false
  const label = hostname.slice(0, -(parent.length + 1))
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(label)
}

const sameHost = (a: string, b: string) => a.trim().toLowerCase().replace(/\.$/, '') === b

/** Add the Dokploy domain for `hostname` unless one is already there. */
export async function ensureRoute(
  client: DokployClient,
  hostname: string,
): Promise<{ created: boolean; domainId: string }> {
  const existing = (await client.listDomains()).find((d) => sameHost(d.host, hostname))
  if (existing) return { created: false, domainId: existing.domainId }
  const created = await client.createDomain(hostname)
  return { created: true, domainId: created.domainId }
}

/** Delete every Dokploy domain for `hostname` on the storefront app; 0 when none was there. */
export async function removeRoute(client: DokployClient, hostname: string): Promise<number> {
  const matches = (await client.listDomains()).filter((d) => sameHost(d.host, hostname))
  for (const d of matches) await client.deleteDomain(d.domainId)
  return matches.length
}

/**
 * Whether the poll should ask for this domain's route now: a live custom domain still
 * without a working certificate, never asked for, or asked for long enough ago that the
 * request was lost, gave up, or the route went missing.
 */
export function needsRouteRequest(row: DomainRow, now: Date): boolean {
  if (row.kind !== 'custom' || row.status !== 'active' || row.sslStatus === 'active') return false
  if (row.routeStatus === 'none' || !row.routeRequestedAt) return true
  return now.getTime() - row.routeRequestedAt.getTime() >= ROUTE_RETRY_MS
}

/** Queue the route for one domain, in the caller's store transaction. */
export async function requestDomainRoute(
  tx: StoreTx,
  storeId: string,
  domainId: string,
  now: Date,
): Promise<void> {
  await tx
    .update(storeDomain)
    .set({ routeStatus: 'pending', routeRequestedAt: now })
    .where(eq(storeDomain.id, domainId))
  await insertOutboxEvent(tx, storeId, 'domain.route_requested', { domainId })
}

export type DomainRouteDeps = {
  db: Db
  /** Null when the Dokploy env keys are unset: every job is skipped. */
  client: DokployClient | null
  guard: RouteGuard
  log?: ((message: string) => void) | undefined
}

export type RouteJobOutcome = 'created' | 'exists' | 'removed' | 'absent' | 'skipped'

/**
 * Run one route job. Throws on a Dokploy failure so the queue retries it; everything else
 * (domain gone, no longer live, hostname refused, Dokploy not configured) is a quiet skip.
 */
export async function runDomainRouteJob(
  deps: DomainRouteDeps,
  job: DomainRouteJob,
): Promise<RouteJobOutcome> {
  const { client } = deps
  if (!client) return 'skipped'

  if (job.action === 'remove') {
    if (!isRoutableHostname(job.hostname, deps.guard)) {
      deps.log?.(`[domains] refused to remove the route for ${job.hostname}`)
      return 'skipped'
    }
    // The hostname may already be live again (reconnected, here or in another store).
    if (await resolveStore(deps.db, job.hostname)) return 'skipped'
    return (await removeRoute(client, job.hostname)) > 0 ? 'removed' : 'absent'
  }

  const row = await withStore(deps.db, job.storeId, async (tx) => {
    const [d] = await tx.select().from(storeDomain).where(eq(storeDomain.id, job.domainId))
    return d ?? null
  })
  if (row?.status !== 'active') return 'skipped'
  const routable =
    row.kind === 'platform'
      ? isStoreAddressHostname(row.hostname, deps.guard)
      : isRoutableHostname(row.hostname, deps.guard)
  if (!routable) {
    deps.log?.(`[domains] refused to add a route for ${row.hostname}`)
    await setRouteStatus(deps.db, job, 'none')
    return 'skipped'
  }
  const r = await ensureRoute(client, row.hostname)
  await setRouteStatus(deps.db, job, 'ready', row.kind === 'platform')
  if (r.created) deps.log?.(`[domains] added the HTTPS route for ${row.hostname}`)
  return r.created ? 'created' : 'exists'
}

async function setRouteStatus(
  db: Db,
  job: Extract<DomainRouteJob, { action: 'add' }>,
  routeStatus: DomainRow['routeStatus'],
  sslActive = false,
): Promise<void> {
  await withStore(db, job.storeId, (tx) =>
    tx
      .update(storeDomain)
      .set(sslActive ? { routeStatus, sslStatus: 'active' } : { routeStatus })
      .where(eq(storeDomain.id, job.domainId)),
  )
}

/**
 * An add job used up its retries: mark the row `failed` (the admin says so in plain words)
 * and let the poll ask again after `ROUTE_RETRY_MS`. Only a still-pending row moves, so a
 * later success is never overwritten.
 */
export async function markDomainRouteFailed(db: Db, job: DomainRouteJob): Promise<void> {
  if (job.action !== 'add') return
  await withStore(db, job.storeId, (tx) =>
    tx
      .update(storeDomain)
      .set({ routeStatus: 'failed' })
      .where(and(eq(storeDomain.id, job.domainId), eq(storeDomain.routeStatus, 'pending'))),
  )
}
