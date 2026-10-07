import { definePlugin } from '@commerce/plugins'
import { COPY_PHOTOS_JOB, copyReviewPhotos } from './photos'
import { scheduleReviewRequests } from './requests'
import { REVIEWS_ID } from './settings'
import { loadReviewsSettings } from './store-settings'

/**
 * Reviews: product reviews with photos, moderation, public store replies, review request
 * emails after delivery and an import of Judge.me's export, so a store moving from
 * Shopify keeps its reviews. Own code throughout: the open-source review tools we looked
 * at are Shopify apps or hosted services, not something to embed (docs/open-source-radar.md).
 */
export const reviewsPlugin = definePlugin({
  id: REVIEWS_ID,
  name: 'Reviews',
  version: '1.0.0',
  kind: 'builtin',
  category: 'marketing',
  description:
    'Collect product reviews with photos, approve or hide them, reply, ask buyers by email after delivery and bring your Judge.me reviews over.',
  provides: {},
  hooks: {
    // Plans the review request emails; the worker's sweep sends them when they are due.
    'order.delivered': async (ctx, payload) => {
      await ctx.inStore(async (tx) =>
        scheduleReviewRequests(
          tx,
          ctx.storeId,
          payload.orderId,
          await loadReviewsSettings(tx, ctx.storeId),
        ),
      )
    },
  },
  jobs: {
    [COPY_PHOTOS_JOB]: async (ctx) => {
      await copyReviewPhotos(ctx)
    },
  },
  admin: {
    icon: 'Star',
    pages: [
      { path: '', title: 'Reviews', navLabel: 'Reviews', icon: 'Star' },
      { path: 'import', title: 'Import from Judge.me', navLabel: 'Import', icon: 'Upload' },
      { path: 'settings', title: 'Review settings', navLabel: 'Settings', icon: 'Settings' },
      { path: 'reviews/[id]', title: 'Review' },
    ],
  },
})
