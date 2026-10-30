import 'server-only'
import {
  type ActiveAbTest,
  activeAbTests,
  recordAbAddToCart,
  recordAbExposure,
  recordAbPurchase,
} from '@commerce/core'
import { isBotUserAgent } from '@commerce/core/marketing'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { type Arm, assignArm } from '@commerce/core/rollout-ab'
import { logger } from '@commerce/observability/logging'
import { cookies, headers } from 'next/headers'
import { after } from 'next/server'
import { cache } from 'react'
import { analyticsAllowed } from './consent-cookie'
import { requestMarketId } from './market-catalog'
import { storeRead } from './store-cache'
import { inStore } from './store-context'
import { parseVisitorId, VISITOR_COOKIE } from './visitor-cookie'

/**
 * A/B rollouts on the storefront (Markets → Rollouts, #120). A running test changes nothing on
 * the store: each request works out the visitor's arm from the anonymous visitor id hashed with
 * the rollout id (`assignArm`), and a Treatment visitor's page is drawn with the rollout's theme.
 *
 * Caching: the running tests are one cached read per store version (`rollout` notifies, 0208);
 * with none running nothing else happens, so visitors outside a test cost nothing. Every render
 * cache key already carries the theme id, so the Treatment's sections are cached apart from the
 * Control's. Only visitors with a visitor id are ever in a test, and that `wc_` cookie already
 * keeps their pages out of the CDN (`edge-cache.ts`): a cookieless page is always the Control.
 *
 * Out of every test (Control, not counted): no yes to analytics or no visitor id yet, bots,
 * visitors outside the test's traffic share or markets, theme previews.
 */

/** The running tests, cached per store version: empty for nearly every store. */
export function runningAbTests(storeId: string): Promise<ActiveAbTest[]> {
  return storeRead(storeId, 'rollout-ab-tests', (tx) => activeAbTests(tx))
}

/** The visitor's arm in one running test, and the theme that arm draws (null: the live one). */
export type RequestRolloutArm = { rolloutId: string; arm: Arm; themeId: string | null }

/** The anonymous visitor id, when the shopper allowed analytics and is not a crawler. */
async function measuredVisitor(): Promise<string | null> {
  try {
    const jar = await cookies()
    if (!analyticsAllowed(jar.get(CONSENT_COOKIE)?.value)) return null
    if (isBotUserAgent((await headers()).get('user-agent'))) return null
    return parseVisitorId(jar.get(VISITOR_COOKIE)?.value)
  } catch {
    // Outside a request (a background warm): nobody, so the Control.
    return null
  }
}

// Exposures already written by this process: one insert per visitor and test, not per page.
const g = globalThis as unknown as { __rolloutAbSeen?: Set<string> }
const SEEN_MAX = 50_000

function noteExposure(storeId: string, rolloutId: string, visitorId: string, arm: Arm): void {
  g.__rolloutAbSeen ??= new Set()
  const seen = g.__rolloutAbSeen
  const key = `${rolloutId}|${visitorId}`
  if (seen.has(key)) return
  if (seen.size >= SEEN_MAX) seen.clear()
  seen.add(key)
  after(() =>
    inStore(storeId, (tx) => recordAbExposure(tx, storeId, { rolloutId, visitorId, arm })).catch(
      (err) => {
        seen.delete(key)
        logger.warn('could not record a rollout exposure', { storeId, error: err })
      },
    ),
  )
}

/**
 * This request's arm in the first running test the visitor is in, once per request; null outside
 * every test. Records the exposure (after the response) the first time a visitor is drawn.
 */
export const requestRolloutArm = cache(
  async (storeId: string): Promise<RequestRolloutArm | null> => {
    const tests = await runningAbTests(storeId)
    if (tests.length === 0) return null
    const visitorId = await measuredVisitor()
    if (!visitorId) return null
    const marketId = await requestMarketId()
    for (const test of tests) {
      const { marketIds, traffic, split } = test.audience
      if (marketIds.length > 0 && (!marketId || !marketIds.includes(marketId))) continue
      const arm = assignArm({ rolloutId: test.id, visitorId, traffic, split })
      if (!arm) continue
      noteExposure(storeId, test.id, visitorId, arm)
      return { rolloutId: test.id, arm, themeId: arm === 'treatment' ? test.themeId : null }
    }
    return null
  },
)

/** The theme a Treatment visitor sees instead of the live one; null for everyone else. */
export async function abThemeId(storeId: string): Promise<string | null> {
  return (await requestRolloutArm(storeId))?.themeId ?? null
}

/** The visitor's first add to cart, for the tests they are in (after the response). */
export async function noteAbAddToCart(storeId: string): Promise<void> {
  if ((await runningAbTests(storeId)).length === 0) return
  const visitorId = await measuredVisitor()
  if (!visitorId) return
  after(() =>
    inStore(storeId, (tx) => recordAbAddToCart(tx, storeId, visitorId)).catch((err) =>
      logger.warn('could not record a rollout add to cart', { storeId, error: err }),
    ),
  )
}

/** Whether a thank-you page should report its order for the store's A/B rollouts. */
export async function abPurchaseMeasured(storeId: string): Promise<boolean> {
  return (await runningAbTests(storeId)).length > 0 && (await measuredVisitor()) !== null
}

/** An order the visitor's thank-you page reported, for the tests they were drawn in. */
export async function recordAbOrder(
  storeId: string,
  visitorId: string,
  orderId: string,
): Promise<void> {
  await inStore(storeId, (tx) => recordAbPurchase(tx, storeId, visitorId, orderId))
}
