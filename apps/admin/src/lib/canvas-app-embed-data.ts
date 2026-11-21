import { FLOATING_TAB, FLOATING_TAB_REVIEWS } from '@commerce/plugin-reviews/blocks'
import { api } from './api-client'

type EmbedLoader = (props: Record<string, unknown>) => Promise<unknown>

/**
 * Store data an app embed draws from on the Customize canvas, by embed type: the same data the
 * storefront hands it (`apps/storefront/src/lib/app-embed-data.ts`), read through the admin API.
 * Embeds without an entry get nothing.
 */
const LOADERS: Record<string, EmbedLoader> = {
  // The floating reviews tab: the latest published reviews, null without the Reviews app.
  [FLOATING_TAB]: (props) =>
    api.reviews.widgets({
      limit: FLOATING_TAB_REVIEWS,
      minRating: typeof props.minRating === 'number' ? props.minRating : 1,
    }),
}

/** The data one embed that is on needs, or undefined when it needs none. */
export function canvasAppEmbedData(type: string, props: Record<string, unknown>): Promise<unknown> {
  const load = LOADERS[type]
  return load ? load(props) : Promise.resolve(undefined)
}
