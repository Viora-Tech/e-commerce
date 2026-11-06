import { randomBytes } from 'node:crypto'
import {
  type Db,
  isUniqueViolation,
  type StoreTx,
  storeDomain,
  storesWithPendingDomains,
  storesWithUnroutedPlatformDomains,
  withStore,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import { type CertReason, reasonOf } from './certificate'
import { type CloudflareConfig, createCloudflareClient } from './cloudflare'
import { createCloudflareDomainProvider, DOMAIN_HELD_ERROR } from './cloudflare-provider'
import { createDevDomainProvider } from './dev-provider'
import { createDnsDomainProvider } from './dns-provider'
import { isApex, isPlatformHostname, normaliseHostname, wwwCounterpart } from './hostname'
import type { DnsState, DomainProvider } from './provider'
import { type DnsRecord, type DomainTargets, dnsRecordsFor } from './records'
import { needsRouteRequest, requestDomainRoute } from './routes'

export type DomainRow = typeof storeDomain.$inferSelect

/** A domain as the admin shows it: the row plus the records to add at the registrar. */
export type DomainView = Omit<DomainRow, 'storeId'> & {
  records: DnsRecord[]
  /** Why the certificate check failed, when it did (`sslStatus` `failed`); the text is in `error`. */
  sslReason: CertReason | null
  /** Another host still holds this name; the merchant must release it there first. */
  heldElsewhere: boolean
  /** An apex that only redirects to its www twin: it can never be primary. */
  redirectOnly: boolean
}

export class DomainError extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('DOMAIN', message, { storeId })
  }
}

/**
 * Provider ids the platform knows: `dev` (offline, decides from the hostname),
 * `dns` (real DNS lookups plus a TLS handshake) and `cloudflare` (custom
 * hostnames on Cloudflare for SaaS). Keep in step with the `DOMAIN_PROVIDER`
 * enum in `@commerce/config`.
 */
export const DOMAIN_PROVIDERS = ['dev', 'dns', 'cloudflare'] as const
export type DomainProviderId = (typeof DOMAIN_PROVIDERS)[number]

/** With Cloudflare in front, an apex cannot be proxied, so it only ever redirects to www. */
export const apexRedirectOnly = (id: string): boolean => id === 'cloudflare'

export function createDomainProvider(
  id: string,
  opts: {
    cloudflare?: CloudflareConfig | null | undefined
    log?: ((message: string) => void) | undefined
  } = {},
): DomainProvider {
  if (id === 'dev') return createDevDomainProvider()
  if (id === 'dns') return createDnsDomainProvider()
  if (id === 'cloudflare') {
    if (!opts.cloudflare) {
      throw new DomainError(
        'DOMAIN_PROVIDER=cloudflare needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID',
      )
    }
    return createCloudflareDomainProvider({
      hostnames: createCloudflareClient(opts.cloudflare),
      log: opts.log,
    })
  }
  throw new DomainError(`Unknown domain provider "${id}"`)
}

export type DomainDeps = {
  provider: DomainProvider
  targets: DomainTargets
  now?: Date | undefined
}

/** A custom apex in a mode where an apex only redirects. A primary one from before still serves. */
function isRedirectOnly(row: DomainRow, redirectOnly: boolean | undefined): boolean {
  return redirectOnly === true && row.kind === 'custom' && !row.isPrimary && isApex(row.hostname)
}

export function domainView(
  row: DomainRow,
  targets: DomainTargets,
  opts: { apexRedirectOnly?: boolean | undefined } = {},
): DomainView {
  const { storeId: _storeId, ...rest } = row
  return {
    ...rest,
    sslReason: row.sslStatus === 'failed' ? reasonOf(row.error) : null,
    heldElsewhere: row.error === DOMAIN_HELD_ERROR,
    redirectOnly: isRedirectOnly(row, opts.apexRedirectOnly),
    records:
      row.kind === 'platform'
        ? []
        : [
            ...dnsRecordsFor(row.hostname, row.verificationToken, targets),
            ...(row.edgeRecords ?? []),
          ],
  }
}

/** Primary first, then the platform's own domains, then custom ones newest first. */
export async function listDomains(tx: StoreTx): Promise<DomainRow[]> {
  return tx
    .select()
    .from(storeDomain)
    .orderBy(desc(storeDomain.isPrimary), desc(storeDomain.kind), asc(storeDomain.createdAt))
}

export async function getDomain(tx: StoreTx, id: string): Promise<DomainRow | null> {
  const [row] = await tx.select().from(storeDomain).where(eq(storeDomain.id, id))
  return row ?? null
}

const newToken = () => `waimers-verify=${randomBytes(16).toString('hex')}`

export type ConnectInput = {
  hostname: string
  /** Send this hostname's visitors to the primary domain instead of serving it directly. */
  redirectToPrimary?: boolean | undefined
  /** Also connect the www twin (or the apex, for a www hostname) as a redirect. */
  includeWwwTwin?: boolean | undefined
}

const heldByAnotherStore = (hostname: string, storeId: string) =>
  new DomainError(
    `${hostname} is connected to another store. Remove it there first, or contact support if it is yours.`,
    storeId,
  )

/**
 * Connect a custom domain. It starts `pending` and only routes once the
 * provider sees the records. Hostnames are unique across the platform: one
 * held by another store is refused without revealing which.
 *
 * With `apexRedirectOnly`, connecting an apex always brings its www twin, which is the domain that
 * serves: the apex only redirects to it, so a www held by another store refuses the whole connect.
 * The www comes first in the result, since its records are the ones that matter.
 */
export async function connectDomain(
  tx: StoreTx,
  storeId: string,
  input: ConnectInput,
  opts: {
    platformRoots: readonly string[]
    targets: DomainTargets
    apexRedirectOnly?: boolean | undefined
  },
): Promise<DomainRow[]> {
  const parsed = normaliseHostname(input.hostname)
  if (!parsed.ok) throw new DomainError(parsed.error, storeId)
  const hostname = parsed.hostname
  if (isPlatformHostname(hostname, opts.platformRoots) || hostname === opts.targets.cnameTarget) {
    throw new DomainError(`${hostname} belongs to the platform and cannot be connected`, storeId)
  }
  const apexFirst = opts.apexRedirectOnly === true && isApex(hostname)
  const twin = input.includeWwwTwin || apexFirst ? wwwCounterpart(hostname) : null
  const wanted = twin ? [hostname, twin] : [hostname]
  const existing = await tx
    .select({ hostname: storeDomain.hostname })
    .from(storeDomain)
    .where(inArray(storeDomain.hostname, wanted))
  if (existing.some((e) => e.hostname === hostname)) {
    throw new DomainError(`${hostname} is already connected to this store`, storeId)
  }

  const insert = async (name: string, redirect: boolean) => {
    // A savepoint, so a clash with another store leaves the outer transaction usable.
    const [row] = await tx.transaction((sp) =>
      sp
        .insert(storeDomain)
        .values({
          storeId,
          hostname: name,
          kind: 'custom',
          status: 'pending',
          sslStatus: 'pending',
          isPrimary: false,
          redirectToPrimary: redirect,
          verificationToken: newToken(),
        })
        .returning(),
    )
    if (!row) throw new Error('store_domain insert returned nothing')
    return row
  }

  const rows: DomainRow[] = []
  try {
    rows.push(await insert(hostname, apexFirst || (input.redirectToPrimary ?? false)))
  } catch (err) {
    if (isUniqueViolation(err)) throw heldByAnotherStore(hostname, storeId)
    throw err
  }
  if (twin && !existing.some((e) => e.hostname === twin)) {
    try {
      rows.push(await insert(twin, !apexFirst))
    } catch (err) {
      // The twin is a convenience, unless the apex depends on it; a clash then refuses it all.
      if (!isUniqueViolation(err)) throw err
      if (apexFirst) throw heldByAnotherStore(twin, storeId)
    }
  }
  return apexFirst ? rows.reverse() : rows
}

/** Remove a custom domain. The platform domain and the primary domain stay. */
export async function removeDomain(tx: StoreTx, storeId: string, id: string): Promise<boolean> {
  const d = await getDomain(tx, id)
  if (!d) return false
  if (d.kind === 'platform') throw new DomainError('The platform domain cannot be removed', storeId)
  if (d.isPrimary) {
    throw new DomainError('Choose another primary domain before removing this one', storeId)
  }
  await tx.delete(storeDomain).where(eq(storeDomain.id, id))
  // The proxy or the edge may hold this hostname: queue its removal (domains/routes.ts).
  if (d.routeStatus !== 'none' || d.edgeRecords !== null) {
    await insertOutboxEvent(tx, storeId, 'domain.route_removed', { hostname: d.hostname })
  }
  return true
}

/**
 * Make a live domain the one every redirect points at. Only a domain with a
 * working certificate qualifies, or shoppers would be sent to a browser warning.
 * With `apexRedirectOnly` an apex never qualifies: its traffic stops at a redirect to www.
 */
export async function setPrimaryDomain(
  tx: StoreTx,
  storeId: string,
  id: string,
  opts: { apexRedirectOnly?: boolean | undefined } = {},
): Promise<DomainRow> {
  const d = await getDomain(tx, id)
  if (!d) throw new DomainError('Domain not found', storeId)
  if (d.isPrimary) return d
  if (isRedirectOnly(d, opts.apexRedirectOnly)) {
    throw new DomainError(
      `${d.hostname} can only redirect, so it cannot be primary. Make www.${d.hostname} your primary domain instead.`,
      storeId,
    )
  }
  if (d.status !== 'active' || d.sslStatus !== 'active') {
    throw new DomainError(
      'Only a connected domain with an active SSL certificate can be primary',
      storeId,
    )
  }
  await tx.update(storeDomain).set({ isPrimary: false }).where(eq(storeDomain.isPrimary, true))
  const [row] = await tx
    .update(storeDomain)
    .set({ isPrimary: true, redirectToPrimary: false })
    .where(eq(storeDomain.id, id))
    .returning()
  if (!row) throw new DomainError('Domain not found', storeId)
  return row
}

export async function setDomainRedirect(
  tx: StoreTx,
  storeId: string,
  id: string,
  redirectToPrimary: boolean,
): Promise<DomainRow> {
  const d = await getDomain(tx, id)
  if (!d) throw new DomainError('Domain not found', storeId)
  if (d.isPrimary && redirectToPrimary) {
    throw new DomainError('The primary domain cannot redirect to itself', storeId)
  }
  const [row] = await tx
    .update(storeDomain)
    .set({ redirectToPrimary })
    .where(eq(storeDomain.id, id))
    .returning()
  if (!row) throw new DomainError('Domain not found', storeId)
  return row
}

function dnsStateOf(status: DomainRow['status']): DnsState {
  if (status === 'active') return 'verified'
  if (status === 'failed') return 'misconfigured'
  return 'pending'
}

/**
 * Ask the provider about one domain and record the answer. A domain that is
 * already live never drops back to pending over a failed check: taking a
 * working storefront offline is worse than a stale badge, so only the error
 * and the certificate state move.
 */
export async function verifyDomain(tx: StoreTx, id: string, deps: DomainDeps): Promise<DomainRow> {
  const d = await getDomain(tx, id)
  if (!d) throw new DomainError('Domain not found')
  if (d.kind === 'platform') return d
  const now = deps.now ?? new Date()
  const r = await deps.provider.check({
    hostname: d.hostname,
    verificationToken: d.verificationToken,
    expected: dnsRecordsFor(d.hostname, d.verificationToken, deps.targets),
    targets: deps.targets,
    previous: { dns: dnsStateOf(d.status), ssl: d.sslStatus, edgeRecords: d.edgeRecords },
    routeReady: d.routeStatus === 'ready',
    verifiedAt: d.verifiedAt,
    now,
  })
  let status = d.status
  let verifiedAt = d.verifiedAt
  if (r.dns === 'verified') {
    status = 'active'
    verifiedAt = verifiedAt ?? now
  } else if (d.status !== 'active') {
    status = r.dns === 'misconfigured' ? 'failed' : 'pending'
  }
  const [row] = await tx
    .update(storeDomain)
    .set({
      status,
      verifiedAt,
      sslStatus: status === 'active' ? r.ssl : 'pending',
      error: r.error,
      edgeRecords: r.edgeRecords ?? null,
      lastCheckedAt: now,
    })
    .where(eq(storeDomain.id, id))
    .returning()
  if (!row) throw new DomainError('Domain not found')
  return row
}

/** Custom domains still waiting on DNS, or live but still waiting on a certificate. */
const awaitingProvider = and(
  eq(storeDomain.kind, 'custom'),
  or(
    eq(storeDomain.status, 'pending'),
    and(eq(storeDomain.status, 'active'), inArray(storeDomain.sslStatus, ['pending', 'issuing'])),
  ),
)

/**
 * The worker's poll: every store with a domain in flight, each domain checked
 * in its own store transaction so one failure never blocks the rest.
 */
export async function pollPendingDomains(
  db: Db,
  deps: DomainDeps & {
    log?: ((message: string) => void) | undefined
    /**
     * True when the proxy's routes are managed for us (the Dokploy env keys are set): a live
     * domain without a working certificate gets its HTTPS route queued (domains/routes.ts).
     */
    requestRoutes?: boolean | undefined
  },
): Promise<{ stores: number; checked: number; failed: number; routes: number }> {
  const storeIds = await storesWithPendingDomains(db)
  let checked = 0
  let failed = 0
  let routes = 0
  for (const storeId of storeIds) {
    const ids = await withStore(db, storeId, async (tx) =>
      tx.select({ id: storeDomain.id }).from(storeDomain).where(awaitingProvider),
    )
    for (const { id } of ids) {
      try {
        const requested = await withStore(db, storeId, async (tx) => {
          const row = await verifyDomain(tx, id, deps)
          const now = deps.now ?? new Date()
          if (!deps.requestRoutes || !needsRouteRequest(row, now)) return false
          await requestDomainRoute(tx, storeId, row.id, now)
          return true
        })
        checked += 1
        if (requested) routes += 1
      } catch (err) {
        failed += 1
        deps.log?.(`[domains] check ${id} failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  if (deps.requestRoutes) routes += await requestMissingPlatformRoutes(db, deps)
  return { stores: storeIds.length, checked, failed, routes }
}

/**
 * Store addresses (`<slug>.<PLATFORM_STORE_DOMAIN>`) whose route was never asked for: a store
 * made before routes were automatic, or while the admin could not ask. Each gets its route
 * queued once; the route job adds it in Dokploy. Returns how many were queued.
 */
async function requestMissingPlatformRoutes(
  db: Db,
  deps: { now?: Date | undefined; log?: ((message: string) => void) | undefined },
): Promise<number> {
  let queued = 0
  for (const storeId of await storesWithUnroutedPlatformDomains(db)) {
    try {
      queued += await withStore(db, storeId, async (tx) => {
        const rows = await tx
          .select({ id: storeDomain.id })
          .from(storeDomain)
          .where(and(eq(storeDomain.kind, 'platform'), eq(storeDomain.routeStatus, 'none')))
        const now = deps.now ?? new Date()
        for (const row of rows) {
          await tx
            .update(storeDomain)
            .set({ sslStatus: 'issuing' })
            .where(eq(storeDomain.id, row.id))
          await requestDomainRoute(tx, storeId, row.id, now)
        }
        return rows.length
      })
    } catch (err) {
      deps.log?.(
        `[domains] store address route for ${storeId} failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }
  return queued
}
