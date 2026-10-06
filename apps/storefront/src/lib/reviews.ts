import 'server-only'
import type { ProductDetail, ReviewsWidgetContext } from '@commerce/blocks'
import { settingsSecret } from '@commerce/config'
import {
  openRequestLink,
  productReviewsFor,
  purchaseOf,
  type RatingSummary,
  requestLinkBuyer,
  reviewsState,
} from '@commerce/plugin-reviews/server'
import { currentCustomer } from './customer-session'
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
  opts: { requestToken: string | null; storeName: string; now?: Date },
): Promise<ProductReviews | undefined> {
  const now = opts.now ?? new Date()
  const me = await currentCustomer(storeId)
  return inStore(storeId, async (tx) => {
    const state = await reviewsState(tx, storeId)
    if (!state.installed) return undefined
    const { summary, reviews } = await productReviewsFor(tx, product.id, state.settings)
    const link = opts.requestToken
      ? openRequestLink(settingsSecret(), opts.requestToken, storeId, now)
      : null
    const fromLink = link && link.productId === product.id ? await requestLinkBuyer(tx, link) : null
    const fromAccount =
      !fromLink && me
        ? await purchaseOf(tx, { productId: product.id, customerId: me.id, email: me.email })
        : null
    const verifiedOrder = fromLink?.orderNumber ?? fromAccount?.orderNumber ?? null
    const onlyVerified = state.settings.whoCanReview === 'verified'
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
        openForm: Boolean(fromLink),
        onlyVerified,
        showPhotos: state.settings.storefront.showPhotos,
      },
    }
  })
}
