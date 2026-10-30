import 'server-only'
import { FLOATING_TAB, FLOATING_TAB_REVIEWS } from '@commerce/plugin-reviews/blocks'
import { reviewsState, storeWidgetReviews } from '@commerce/plugin-reviews/server'
import { storeRead } from './store-cache'

type EmbedLoader = (storeId: string, props: Record<string, unknown>) => Promise<unknown>

/**
 * Store data an app embed draws from, by embed type: the storefront reads it (cached per store
 * version, under the store's RLS) and hands it to the embed as `data`, the way the product page
 * hands app blocks `appBlockContext`. Embeds without an entry get nothing.
 */
const LOADERS: Record<string, EmbedLoader> = {
  // The floating reviews tab: the latest published reviews, null without the Reviews app.
  [FLOATING_TAB]: (storeId, props) => {
    const minRating = typeof props.minRating === 'number' ? props.minRating : 1
    return storeRead(storeId, `floating-reviews|${minRating}`, async (tx) => {
      const state = await reviewsState(tx, storeId)
      if (!state.installed) return null
      return storeWidgetReviews(tx, state.settings, { limit: FLOATING_TAB_REVIEWS, minRating })
    })
  },
}

/** The data one embed that is on needs, or undefined when it needs none. */
export function appEmbedData(
  storeId: string,
  type: string,
  props: Record<string, unknown>,
): Promise<unknown> {
  const load = LOADERS[type]
  return load ? load(storeId, props) : Promise.resolve(undefined)
}
