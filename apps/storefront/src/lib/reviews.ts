import 'server-only'
import type { ProductDetail, ReviewsWidgetContext } from '@commerce/blocks'
import { settingsSecret } from '@commerce/config'
import {
  openRequestLink,
  productReviewsFor,
  productSummary,
  purchaseOf,
  type RatingSummary,
  requestLinkBuyer,
  reviewsState,
} from '@commerce/plugin-reviews/server'
import { currentCustomer } from './customer-session'
import { storeRead } from './store-cache'
import { inStore } from './store-context'

const DAY = 24 * 60 * 60 * 1000

/** "Today", "2 days ago", "3 weeks ago": how old a review is, from the server's clock. */
export function ageLabel(at: Date | string, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(at).getTime()) / DAY))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} ${days < 14 ? 'week' : 'weeks'} ago`
  if (days < 365) return `${Math.floor(days / 30)} ${days < 60 ? 'month' : 'months'} ago`
  const years = Math.floor(days / 365)
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}

export type ProductReviews = {
  widget: ReviewsWidgetContext
  summary: RatingSummary
}

/**
 * Everything the product page needs from the Reviews app: the widget's data and the rating
 * summary (for the stars under the title and the JSON-LD). Undefined when the store has not
 * installed the app, so the page keeps its empty-state text. The shopper counts as a
 * verified buyer through a review request link (`?review=`) or their signed-in account.
 */
export async function productReviews(
  storeId: string,
  product: ProductDetail,
  opts: { requestToken: string | null; openForm?: boolean; storeName: string; now?: Date },
): Promise<ProductReviews | undefined> {
  const now = opts.now ?? new Date()
  const me = await currentCustomer(storeId)
  // The reviews themselves are the same for every shopper: cached per store version.
  const shared = await storeRead(storeId, `product-reviews|${product.id}`, async (tx) => {
    const state = await reviewsState(tx, storeId)
    if (!state.installed) return null
    return {
      settings: state.settings,
      ...(await productReviewsFor(tx, product.id, state.settings)),
      aiSummary: state.settings.aiSummary.enabled
        ? ((await productSummary(tx, product.id))?.text ?? null)
        : null,
    }
  })
  if (!shared) return undefined
  const { settings, summary, reviews, aiSummary } = shared
  // Whether this shopper bought it: through a review request link, or their signed-in account.
  const link = opts.requestToken
    ? openRequestLink(settingsSecret(), opts.requestToken, storeId, now)
    : null
  const linked = link && link.productId === product.id ? link : null
  const buyer =
    linked || me
      ? await inStore(storeId, async (tx) => {
          const fromLink = linked ? await requestLinkBuyer(tx, linked) : null
          const fromAccount =
            !fromLink && me
              ? await purchaseOf(tx, { productId: product.id, customerId: me.id, email: me.email })
              : null
          return { fromLink, fromAccount }
        })
      : { fromLink: null, fromAccount: null }
  const { fromLink, fromAccount } = buyer
  const verifiedOrder = fromLink?.orderNumber ?? fromAccount?.orderNumber ?? null
  const onlyVerified = settings.whoCanReview === 'verified'
  const write: ReviewsWidgetContext['write'] =
    !onlyVerified || verifiedOrder !== null ? 'open' : me ? 'not_buyer' : 'signin'
  const back = `/products/${product.handle}#reviews`
  return {
    summary,
    widget: {
      productId: product.id,
      productTitle: product.title,
      productImage: product.images.find((i) => !i.contentType?.startsWith('video/'))?.url ?? null,
      storeName: opts.storeName,
      summary,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        name: r.name,
        verified: r.verified,
        helpful: r.helpful,
        reply: r.reply,
        whenLabel: ageLabel(r.createdAt, now),
        photos: r.photos,
      })),
      write,
      signInUrl: `/account/login?return_to=${encodeURIComponent(back)}`,
      verifiedOrder,
      requestToken: fromLink ? opts.requestToken : null,
      knownName: fromLink?.name || me?.name || '',
      emailKnown: Boolean(fromLink || me?.email),
      openForm: Boolean(fromLink) || (opts.openForm === true && write === 'open'),
      onlyVerified,
      showPhotos: settings.storefront.showPhotos,
      aiSummary,
    },
  }
}
