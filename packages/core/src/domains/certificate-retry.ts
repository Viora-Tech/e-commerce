/** SOURCE OF TRUTH: certificate retry for store addresses and custom domains — WHAT: the sweep that checks every registered host over TLS, re-registers it in Dokploy when DNS is right but the certificate is missing, and the merchant's "Retry certificate" / WHY: Let's Encrypt fails once on a missing DNS record and Traefik never asks again until the route is re-created */

/*
 * Per row, `checkCertificate`:
 *   certificate trusted for the host      -> ssl `active`
 *   DNS does not point at us              -> ssl `failed`, reason "DNS not pointing here yet"
 *   DNS right, no certificate, early      -> ssl `issuing` (the first issuance may still be running)
 *   DNS right, no certificate, later      -> re-register the route in Dokploy (delete + create, which
 *                                            starts a new ACME attempt), ssl `issuing`, re-check after
 *                                            a pause; still none -> ssl `failed`, "Certificate pending"
 * `runCertificateSweep` runs this for every due row (schedule in certificate.ts). The merchant's
 * button queues the same thing through the route job with `reregister`, so the Dokploy keys stay
 * in the worker. A host that already has a certificate is never touched.
 */
import {
  type Db,
  type StoreTx,
  storeDomain,
  storesWithCertificateChecks,
  withStore,
} from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import {
  CERT_GRACE_MS,
  CERT_REASON,
  type CertChecker,
  certCheckDue,
  dnsPointsHere,
  REREGISTER_AFTER_MS,
  REREGISTER_GAP_MS,
} from './certificate'
import type { DnsResolver } from './dns-provider'
import type { DokployClient } from './dokploy'
import type { DomainTargets } from './records'
import {
  ensureRoute,
  isRoutableHostname,
  isStoreAddressHostname,
  type RouteGuard,
  removeRoute,
  requestDomainRoute,
} from './routes'
import { DomainError } from './service'

type DomainRow = typeof storeDomain.$inferSelect

export type CertificateDeps = {
  db: Db
  /** Null when the Dokploy keys are unset: DNS and certificate are still checked, nothing is re-registered. */
  client: DokployClient | null
  guard: RouteGuard
  targets: DomainTargets
  tlsCheck: CertChecker
  resolver: Pick<DnsResolver, 'resolve4'>
  /** How long to wait after a re-register before looking again (Traefik needs a few seconds). */
  settleMs?: number | undefined
  sleep?: ((ms: number) => Promise<void>) | undefined
  now?: Date | undefined
  log?: ((message: string) => void) | undefined
}

export type CertOutcome =
  | 'active'
  | 'issuing'
  | 'dns'
  | 'certificate'
  | 'reregistered'
  | 'unchanged'
  | 'skipped'

const SETTLE_MS = 20_000

function routable(row: DomainRow, guard: RouteGuard): boolean {
  return row.kind === 'platform'
    ? isStoreAddressHostname(row.hostname, guard)
    : isRoutableHostname(row.hostname, guard)
}

async function patch(
  deps: CertificateDeps,
  row: DomainRow,
  set: Partial<typeof storeDomain.$inferInsert>,
) {
  await withStore(deps.db, row.storeId, (tx) =>
    tx
      .update(storeDomain)
      .set({ sslCheckedAt: deps.now ?? new Date(), ...set })
      .where(eq(storeDomain.id, row.id)),
  )
}

type Look = 'valid' | 'dns' | 'certificate' | 'unknown'

async function look(deps: CertificateDeps, row: DomainRow): Promise<Look> {
  const state = await deps.tlsCheck(row.hostname)
  if (state === 'valid') return 'valid'
  // A live host that cannot be reached right now is not proof its certificate is gone.
  if (row.sslStatus === 'active' && state === 'unreachable') return 'unknown'
  const here = await dnsPointsHere(row.hostname, deps.targets, deps.resolver)
  if (here === null) return 'unknown'
  return here ? 'certificate' : 'dns'
}

/**
 * Check one registered host and record the result. `force` re-registers at once (the merchant's
 * button); `register: false` only looks (the second look after a re-register). Throws when
 * Dokploy fails during a re-register, so a queued job retries.
 */
export async function checkCertificate(
  deps: CertificateDeps,
  row: DomainRow,
  opts: { force?: boolean; register?: boolean } = {},
): Promise<CertOutcome> {
  if (!routable(row, deps.guard)) return 'skipped'
  const now = deps.now ?? new Date()
  const seen = await look(deps, row)

  if (seen === 'valid') {
    await patch(deps, row, { sslStatus: 'active', error: null })
    return 'active'
  }
  if (seen === 'unknown') {
    await patch(deps, row, {})
    return 'unchanged'
  }

  // A row that was active (or never timed) starts its wait now.
  const startedAt = row.sslStatus === 'active' || !row.sslStartedAt ? now : row.sslStartedAt
  if (seen === 'dns') {
    await patch(deps, row, { sslStatus: 'failed', error: CERT_REASON.dns, sslStartedAt: startedAt })
    return 'dns'
  }

  const waiting = now.getTime() - startedAt.getTime()
  const sinceRegister = now.getTime() - (row.routeRequestedAt?.getTime() ?? 0)
  const canRegister =
    deps.client !== null &&
    opts.register !== false &&
    (opts.force === true || (waiting >= REREGISTER_AFTER_MS && sinceRegister >= REREGISTER_GAP_MS))
  if (canRegister && deps.client) {
    await removeRoute(deps.client, row.hostname)
    await ensureRoute(deps.client, row.hostname)
    deps.log?.(`[domains] re-registered ${row.hostname} to retry its certificate`)
    await patch(deps, row, {
      sslStatus: 'issuing',
      error: null,
      sslStartedAt: startedAt,
      routeStatus: 'ready',
      routeRequestedAt: now,
    })
    return 'reregistered'
  }
  if (waiting < CERT_GRACE_MS) {
    await patch(deps, row, { sslStatus: 'issuing', error: null, sslStartedAt: startedAt })
    return 'issuing'
  }
  await patch(deps, row, {
    sslStatus: 'failed',
    error: CERT_REASON.certificate,
    sslStartedAt: startedAt,
  })
  return 'certificate'
}

async function loadRow(db: Db, storeId: string, domainId: string): Promise<DomainRow | null> {
  return withStore(db, storeId, async (tx) => {
    const [row] = await tx.select().from(storeDomain).where(eq(storeDomain.id, domainId))
    return row ?? null
  })
}

/** Wait for Traefik to try, then look once more without re-registering again. */
export async function recheckAfterSettle(
  deps: CertificateDeps,
  storeId: string,
  domainId: string,
): Promise<CertOutcome> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  await sleep(deps.settleMs ?? SETTLE_MS)
  const row = await loadRow(deps.db, storeId, domainId)
  if (!row) return 'skipped'
  return checkCertificate(deps, row, { register: false })
}

export type SweepResult = {
  stores: number
  checked: number
  reregistered: number
  active: number
  failed: number
}

/**
 * The worker's periodic job. Looks at every due row, re-registers the ones whose DNS is right but
 * whose certificate is missing, then (one pause for all of them) looks again. One failing row never
 * stops the rest.
 */
export async function runCertificateSweep(deps: CertificateDeps): Promise<SweepResult> {
  const now = deps.now ?? new Date()
  const storeIds = await storesWithCertificateChecks(deps.db)
  const result: SweepResult = {
    stores: storeIds.length,
    checked: 0,
    reregistered: 0,
    active: 0,
    failed: 0,
  }
  const again: { storeId: string; domainId: string }[] = []
  for (const storeId of storeIds) {
    const rows = await withStore(deps.db, storeId, (tx) =>
      tx
        .select()
        .from(storeDomain)
        .where(and(eq(storeDomain.status, 'active'), eq(storeDomain.routeStatus, 'ready'))),
    )
    for (const row of rows.filter((r) => certCheckDue(r, now))) {
      try {
        const out = await checkCertificate(deps, row)
        result.checked += 1
        if (out === 'active') result.active += 1
        if (out === 'reregistered') {
          result.reregistered += 1
          again.push({ storeId, domainId: row.id })
        }
      } catch (err) {
        result.failed += 1
        deps.log?.(
          `[domains] certificate check ${row.hostname} failed: ${err instanceof Error ? err.message : err}`,
        )
      }
    }
  }
  for (const [i, a] of again.entries()) {
    try {
      // Only the first waits; the rest were re-registered at about the same time.
      const settleMs = i === 0 ? deps.settleMs : 0
      await recheckAfterSettle({ ...deps, settleMs }, a.storeId, a.domainId)
    } catch (err) {
      deps.log?.(
        `[domains] certificate re-check failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  }
  return result
}

/** Minimum gap between a merchant's retries of one domain. */
export const RETRY_REQUEST_GAP_MS = 2 * 60_000

/**
 * The merchant's "Retry certificate": allowed for a connected domain whose certificate is not
 * active, at most once every two minutes. Restarts the wait and queues a re-register job (the
 * worker holds the Dokploy keys); the job then re-checks and records the result.
 */
export async function requestCertificateRetry(
  tx: StoreTx,
  storeId: string,
  domainId: string,
  now: Date = new Date(),
): Promise<DomainRow> {
  const [row] = await tx.select().from(storeDomain).where(eq(storeDomain.id, domainId))
  if (!row) throw new DomainError('Domain not found', storeId)
  if (row.status !== 'active') {
    throw new DomainError(
      'Finish connecting this domain first: its DNS records are not verified yet',
      storeId,
    )
  }
  if (row.sslStatus === 'active') {
    throw new DomainError('This domain already has an active certificate', storeId)
  }
  if (
    row.routeRequestedAt &&
    now.getTime() - row.routeRequestedAt.getTime() < RETRY_REQUEST_GAP_MS
  ) {
    throw new DomainError(
      'A certificate retry just started. Wait a couple of minutes and check again',
      storeId,
    )
  }
  const [updated] = await tx
    .update(storeDomain)
    .set({ sslStatus: 'issuing', error: null, sslStartedAt: now })
    .where(eq(storeDomain.id, domainId))
    .returning()
  await requestDomainRoute(tx, storeId, domainId, now, { reregister: true })
  return updated ?? row
}
