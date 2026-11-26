/** SOURCE OF TRUTH: Affiliates › Settings › Portal address — WHAT: the portal's current address and connecting, verifying or removing `affiliate.<primary domain>` / WHY: the merchant sets the portal's own address inside the app; every step goes through the same domain service as Settings › Domains, limited to that one hostname */

import { listDomains, permissions, removeDomain } from '@commerce/core'
import { findPortalDomain, portalFallbackUrl, portalHostname } from '@commerce/core/domains'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'
import {
  connectStoreDomain,
  domainErrorsToBadRequest,
  toDomainView,
  verifyStoreDomain,
} from '../services/domains.service'
import { program } from './affiliates-extras'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

/** Reading needs the app and Settings › Domains read; changing needs both write grants. */
const read = () => can(permissions.MARKETING_READ, () => [permissions.SETTINGS_READ])
const manage = () => can(permissions.MARKETING_WRITE, () => [permissions.SETTINGS_MANAGE])

/** The card's state: where the portal answers now, the host to connect and its row if any. */
async function portalState(context: Ctx) {
  await program(context)
  const domains = await listDomains(context.tx)
  const row = findPortalDomain(domains)
  return {
    /** `https://www.waimers.in/affiliate`: always works, also once the host is live. */
    fallbackUrl: portalFallbackUrl(domains),
    /** `affiliate.<primary custom domain>`; null while the primary is the platform address. */
    hostname: portalHostname(domains),
    domain: row ? toDomainView(row) : null,
  }
}

/** The store's portal row, or a refusal the card can show. */
async function portalRow(context: Ctx) {
  const state = await portalState(context)
  if (!state.domain) {
    throw new ORPCError('NOT_FOUND', { message: 'The portal address is not connected' })
  }
  return state.domain
}

export const affiliatePortalDomainRouter = {
  get: read().handler(({ context }) => portalState(context)),

  /** Connect `affiliate.<primary domain>`: not primary, serves itself, no www twin. */
  connect: manage().handler(async ({ context }) => {
    const state = await portalState(context)
    if (!state.hostname) {
      throw new ORPCError('PRECONDITION_FAILED', {
        message: 'Connect your own domain and make it primary first',
      })
    }
    if (state.domain) return state
    const hostname = state.hostname
    await domainErrorsToBadRequest(() =>
      connectStoreDomain(context.tx, context.scope.storeId, {
        hostname,
        redirectToPrimary: false,
        includeWwwTwin: false,
      }),
    )
    return portalState(context)
  }),

  /** Check the records now, as Verify connection does on the domain's page. */
  verify: manage().handler(async ({ context }) => {
    const row = await portalRow(context)
    await domainErrorsToBadRequest(() => verifyStoreDomain(context.tx, row.id))
    return portalState(context)
  }),

  /** Disconnect the portal host; `/affiliate` on the store's domains keeps working. */
  remove: manage().handler(async ({ context }) => {
    const row = await portalRow(context)
    await domainErrorsToBadRequest(() => removeDomain(context.tx, context.scope.storeId, row.id))
    return portalState(context)
  }),
}
