import { randomBytes } from 'node:crypto'
import {
  type Db,
  isUniqueViolation,
  type StoreTx,
  storeDomain,
  storesWithPendingDomains,
  withStore,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { createDevDomainProvider } from './dev-provider'
import { createDnsDomainProvider } from './dns-provider'
import { isPlatformHostname, normaliseHostname, wwwCounterpart } from './hostname'
import type { DnsState, DomainProvider } from './provider'
import { type DnsRecord, type DomainTargets, dnsRecordsFor } from './records'

export type DomainRow = typeof storeDomain.$inferSelect

/** A domain as the admin shows it: the row plus the records to add at the registrar. */
export type DomainView = Omit<DomainRow, 'storeId'> & { records: DnsRecord[] }

export class DomainError extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('DOMAIN', message, { storeId })
  }
}

/**
 * Provider ids the platform knows: `dev` (offline, decides from the hostname)
 * and `dns` (real DNS lookups plus a TLS handshake). Keep in step with the
 * `DOMAIN_PROVIDER` enum in `@commerce/config`.
 */
export const DOMAIN_PROVIDERS = ['dev', 'dns'] as const
export type DomainProviderId = (typeof DOMAIN_PROVIDERS)[number]

export function createDomainProvider(id: string): DomainProvider {
  if (id === 'dev') return createDevDomainProvider()
  if (id === 'dns') return createDnsDomainProvider()
  throw new DomainError(`Unknown domain provider "${id}"`)
}

export type DomainDeps = {
  provider: DomainProvider
  targets: DomainTargets
  now?: Date | undefined
}

export function domainView(row: DomainRow, targets: DomainTargets): DomainView {
  const { storeId: _storeId, ...rest } = row
  return {
    ...rest,
    records:
      row.kind === 'platform' ? [] : dnsRecordsFor(row.hostname, row.verificationToken, targets),
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

/**
 * Connect a custom domain. It starts `pending` and only routes once the
 * provider sees the records. Hostnames are unique across the platform: one
 * held by another store is refused without revealing which.
 */
export async function connectDomain(
  tx: StoreTx,
  storeId: string,
  input: ConnectInput,
  opts: { platformRoots: readonly string[]; targets: DomainTargets },
): Promise<DomainRow[]> {
  const parsed = normaliseHostname(input.hostname)
  if (!parsed.ok) throw new DomainError(parsed.error, storeId)
  const hostname = parsed.hostname
  if (isPlatformHostname(hostname, opts.platformRoots) || hostname === opts.targets.cnameTarget) {
    throw new DomainError(`${hostname} belongs to the platform and cannot be connected`, storeId)
  }
  const twin = input.includeWwwTwin ? wwwCounterpart(hostname) : null
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
    rows.push(await insert(hostname, input.redirectToPrimary ?? false))
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DomainError(
        `${hostname} is connected to another store. Remove it there first, or contact support if it is yours.`,
        storeId,
      )
    }
    throw err
  }
  if (twin && !existing.some((e) => e.hostname === twin)) {
    try {
      rows.push(await insert(twin, true))
    } catch (err) {
      // The twin is a convenience; a clash with another store only skips it.
      if (!isUniqueViolation(err)) throw err
    }
  }
  return rows
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
  return true
}

/**
 * Make a live domain the one every redirect points at. Only a domain with a
 * working certificate qualifies, or shoppers would be sent to a browser warning.
 */
export async function setPrimaryDomain(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<DomainRow> {
  const d = await getDomain(tx, id)
  if (!d) throw new DomainError('Domain not found', storeId)
  if (d.isPrimary) return d
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
    previous: { dns: dnsStateOf(d.status), ssl: d.sslStatus },
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
  deps: DomainDeps & { log?: ((message: string) => void) | undefined },
): Promise<{ stores: number; checked: number; failed: number }> {
  const storeIds = await storesWithPendingDomains(db)
  let checked = 0
  let failed = 0
  for (const storeId of storeIds) {
    const ids = await withStore(db, storeId, async (tx) =>
      tx.select({ id: storeDomain.id }).from(storeDomain).where(awaitingProvider),
    )
    for (const { id } of ids) {
      try {
        await withStore(db, storeId, (tx) => verifyDomain(tx, id, deps))
        checked += 1
      } catch (err) {
        failed += 1
        deps.log?.(`[domains] check ${id} failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  return { stores: storeIds.length, checked, failed }
}
