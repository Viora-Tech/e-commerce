import { ReviewsCarousel } from '@commerce/blocks'
import { reviewsState, storeWidgetReviews } from '@commerce/plugin-reviews/server'
import { importedReviewsContent as copy } from '@/data/imported-reviews'
import { storeRead } from '@/lib/store-cache'
import LiquidAppBlock from './liquid-app-block'

type LiquidReviewsCarouselProps = { storeId: string }

/** As many reviews as a shopper could want to scroll through. */
const CAROUSEL_REVIEWS = 12

/**
 * Our Reviews app's carousel where an imported theme had Judge.me's: the theme leaves a slot on
 * pages that have that block, and without one this draws nothing. No reviews draws nothing too,
 * so the theme's empty section is never given a heading with no cards under it.
 */
export default async function LiquidReviewsCarousel({ storeId }: LiquidReviewsCarouselProps) {
  // Hooks
  const data = await storeRead(storeId, 'imported-reviews-carousel', async (tx) => {
    const state = await reviewsState(tx, storeId)
    return state.installed
      ? storeWidgetReviews(tx, state.settings, { limit: CAROUSEL_REVIEWS })
      : null
  })

  // Early returns
  if (!data?.reviews.length) return null

  // Render logic
  return (
    <LiquidAppBlock slot="reviews-carousel">
      <ReviewsCarousel
        kicker=""
        heading={copy.heading}
        data={data}
        showSummary
        showProduct
        showPhotos
        showDate={false}
        cardStyle="card"
        autoplay
        speed={5}
      />
    </LiquidAppBlock>
  )
}
