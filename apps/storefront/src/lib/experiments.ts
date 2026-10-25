import 'server-only'
import { loadEnv } from '@commerce/config'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import {
  type Assignments,
  assignmentsKey,
  type FeatureEvaluator,
  featureEvaluator,
  liquidExperiments,
  NO_ASSIGNMENTS,
  ttlCache,
} from '@commerce/plugin-growthbook/assign'
import { growthbookClient, parseTrustedOrigins } from '@commerce/plugin-growthbook/client'
import { growthbookConnectionFor } from '@commerce/plugin-growthbook/server'
import type { GrowthbookConnection } from '@commerce/plugin-growthbook/settings'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { analyticsAllowed } from './consent-cookie'
import { storeRead } from './store-cache'
import { parseVisitorId, VISITOR_COOKIE } from './visitor-cookie'

/**
 * GrowthBook experiments on the storefront (the GrowthBook app). Each store's SDK connection is
 * fetched at most once a minute per server and kept as a ready evaluator; a shopper who allowed
 * analytics is assigned on the server from the anonymous visitor id, so the page arrives already
 * showing their variant. Everyone else (no consent yet, no visitor id, app not set up, GrowthBook
 * down) gets no assignments and sees each experiment's control.
 */

/** How long one store's features are reused before GrowthBook is asked again. */
const FEATURES_TTL_MS = 60_000

/** A page never waits longer than this on GrowthBook; past it, shoppers see the control. */
const FEATURES_TIMEOUT_MS = 2_000

const evaluators = ttlCache<FeatureEvaluator>(FEATURES_TTL_MS)

/** The store's GrowthBook connection, cached per store version; null unless set up. */
function connectionFor(storeId: string): Promise<GrowthbookConnection | null> {
  return storeRead(storeId, 'growthbook-connection', (tx) => growthbookConnectionFor(tx, storeId))
}

function evaluatorFor(connection: GrowthbookConnection): Promise<FeatureEvaluator | null> {
  const key = [connection.apiHost, connection.clientKey, connection.decryptionKey].join('|')
  return evaluators.get(key, async () => {
    const client = growthbookClient({
      apiHost: connection.apiHost,
      trustedOrigins: parseTrustedOrigins(loadEnv(process.env).GROWTHBOOK_TRUSTED_ORIGINS),
      timeoutMs: FEATURES_TIMEOUT_MS,
    })
    return featureEvaluator(await client.features(connection.clientKey), connection.decryptionKey)
  })
}

/** Whether the store has GrowthBook set up: then purchases are worth recording. */
export async function experimentsEnabled(storeId: string): Promise<boolean> {
  return (await connectionFor(storeId)) !== null
}

/** The experiments one visitor is in, for a store; none when the app is not set up or is down. */
export async function assignVisitor(storeId: string, visitorId: string): Promise<Assignments> {
  const connection = await connectionFor(storeId)
  if (!connection) return NO_ASSIGNMENTS
  const evaluator = await evaluatorFor(connection)
  return evaluator ? evaluator.assign(visitorId) : NO_ASSIGNMENTS
}

export type RequestExperiments = {
  /** The anonymous visitor id, when the shopper allowed analytics and has one. */
  visitorId: string | null
  assignments: Assignments
}

const NOBODY: RequestExperiments = { visitorId: null, assignments: NO_ASSIGNMENTS }

/**
 * This request's assignments, once per request. Only with a yes to analytics on the cookie
 * banner: experiments read the visitor id and are measured, so they wait for consent like the
 * visit beacon does.
 */
export const requestExperiments = cache(async (storeId: string): Promise<RequestExperiments> => {
  const jar = await cookies()
  if (!analyticsAllowed(jar.get(CONSENT_COOKIE)?.value)) return NOBODY
  const visitorId = parseVisitorId(jar.get(VISITOR_COOKIE)?.value)
  if (!visitorId) return NOBODY
  return { visitorId, assignments: await assignVisitor(storeId, visitorId) }
})

/**
 * What an imported theme's Liquid sees (`request.experiments`) and the label its render cache is
 * keyed by. A theme preview renders each experiment's control, like a shopper outside it.
 */
export async function liquidExperimentsFor(
  storeId: string,
  preview: boolean,
): Promise<{ experiments: Record<string, number>; experimentsKey: string }> {
  const { assignments } = preview ? NOBODY : await requestExperiments(storeId)
  return {
    experiments: liquidExperiments(assignments),
    experimentsKey: assignmentsKey(assignments),
  }
}
