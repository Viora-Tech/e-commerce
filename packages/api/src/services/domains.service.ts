/** SOURCE OF TRUTH: the domain flow's wiring — WHAT: record targets, the provider, the view and connect/verify for one store's domains / WHY: Settings › Domains and the Affiliates app's Portal address card connect hostnames through the same calls, so DNS records, verification and the edge never differ between them */

import { loadEnv } from '@commerce/config'
import {
  apexRedirectOnly,
  type ConnectInput,
  cloudflareConfigFrom,
  connectDomain,
  createDomainProvider,
  DomainError,
  type DomainRow,
  type DomainTargets,
  type DomainView,
  platformRoots,
  verifyDomain,
  domainView as viewOf,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { ORPCError } from '@orpc/server'

const env = () => loadEnv(process.env)

/** Where a custom domain's records point on this server. */
export const domainTargets = (): DomainTargets => ({
  aRecord: env().STOREFRONT_A_RECORD,
  cnameTarget: env().STOREFRONT_CNAME_TARGET,
})

/** With Cloudflare in front an apex only redirects to its www. */
export const domainRedirectOnly = (): boolean => apexRedirectOnly(env().DOMAIN_PROVIDER)

/** A row as the admin sees it: its records, certificate reason and redirect-only flag. */
export const toDomainView = (d: DomainRow, t: DomainTargets = domainTargets()): DomainView =>
  viewOf(d, t, { apexRedirectOnly: domainRedirectOnly() })

/** A domain refusal ("already connected") reaches the admin as its own words. */
export async function domainErrorsToBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof DomainError) throw new ORPCError('BAD_REQUEST', { message: err.message })
    throw err
  }
}

/** Connect a custom domain (pending until its records are seen), as Settings › Domains does. */
export async function connectStoreDomain(
  tx: StoreTx,
  storeId: string,
  input: ConnectInput,
): Promise<DomainView[]> {
  const t = domainTargets()
  const rows = await connectDomain(tx, storeId, input, {
    platformRoots: platformRoots(env()),
    targets: t,
    apexRedirectOnly: domainRedirectOnly(),
  })
  return rows.map((d) => toDomainView(d, t))
}

/** Check one domain's DNS and SSL now instead of waiting for the worker's poll. */
export async function verifyStoreDomain(tx: StoreTx, id: string): Promise<DomainView> {
  const t = domainTargets()
  const d = await verifyDomain(tx, id, {
    provider: createDomainProvider(env().DOMAIN_PROVIDER, {
      cloudflare: cloudflareConfigFrom(env()),
      log: (m) => logger.warn(m, { area: 'domains' }),
    }),
    targets: t,
  })
  return toDomainView(d, t)
}
