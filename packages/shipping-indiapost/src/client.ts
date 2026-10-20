import type { ShippingCapability } from '@commerce/shipping'

/**
 * What the admin shows in the browser about India Post, with no adapter code behind it. The
 * adapter imports `@commerce/shipping`, whose webhook check uses `node:crypto`, so client
 * components import from `/client`, never the package root.
 */

export {
  ARTICLE_NUMBER_PROBLEMS,
  type ArticleKind,
  type ArticleNumberResult,
  normaliseArticleNumber,
  parseArticleNumber,
} from './article-number'

export const INDIA_POST_ID = 'india-post'

/** India Post's public tracker. It takes no number in the link: the shopper pastes it there. */
export const INDIA_POST_TRACKING_PAGE = 'https://www.indiapost.gov.in/'

/** Where the admin serves our address label for an article number (an app page). */
export function indiaPostLabelPath(articleNumber: string): string {
  return `/apps/india-post/labels/${encodeURIComponent(articleNumber)}`
}

/**
 * What this adapter can do. No `tracking`: statuses are set by hand (see india-post.ts), so the
 * admin offers no "Refresh tracking" for it. `cancel` only marks our own record cancelled.
 */
export const INDIA_POST_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
  'label',
  'cancel',
]
