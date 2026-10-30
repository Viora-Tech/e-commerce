import type { ComponentConfig } from '@puckeditor/core'
import type { ReviewsLoader } from '../types'
import { type AllReviewsProps, allReviewsSection } from './reviews-widgets/all-reviews'
import { type ReviewsCarouselProps, reviewsCarouselSection } from './reviews-widgets/carousel'
import { type ReviewPhotosProps, reviewPhotosSection } from './reviews-widgets/photo-grid'
import { type ProductQuestionsProps, productQuestionsSection } from './reviews-widgets/questions'
import { type ReviewSnippetProps, reviewSnippetSection } from './reviews-widgets/snippet'
import { type ReviewSummaryProps, reviewSummarySection } from './reviews-widgets/summary'
import {
  type ReviewsTestimonialsProps,
  reviewsTestimonialsSection,
} from './reviews-widgets/testimonials'

/**
 * SOURCE OF TRUTH KEYWORDS: reviewsWidgetSections, REVIEWS_WIDGET_SECTIONS, Reviews app sections
 * WHAT:  The Reviews app's theme sections (Judge.me's widgets, rebuilt): carousel, testimonials,
 *        all reviews, review photos, the snippet near Add to cart, the AI summary
 *        and questions and answers. Their types are namespaced
 *        `reviews/<Name>` like app blocks, so the editor files them under Apps › Reviews.
 * WHY:   They read the store's published reviews through `loadReviews` (storefront: the
 *        database; editor: the API), which a plugin's own blocks cannot reach.
 * WHERE: `../puck-config.tsx` registers them and lists them on the Apps tab while the app is
 *        installed; the floating tab is the app's embed (`@commerce/plugin-reviews/blocks`).
 */
export const REVIEWS_APP_ID = 'reviews'

export type ReviewsWidgetProps = {
  'reviews/Carousel': ReviewsCarouselProps
  'reviews/Testimonials': ReviewsTestimonialsProps
  'reviews/AllReviews': AllReviewsProps
  'reviews/Photos': ReviewPhotosProps
  'reviews/Snippet': ReviewSnippetProps
  'reviews/Summary': ReviewSummaryProps
  'reviews/Questions': ProductQuestionsProps
}

const BUILDERS: {
  [K in keyof ReviewsWidgetProps]: (loadReviews: ReviewsLoader | undefined) => ComponentConfig
} = {
  'reviews/Carousel': reviewsCarouselSection,
  'reviews/Testimonials': reviewsTestimonialsSection,
  'reviews/AllReviews': allReviewsSection,
  'reviews/Photos': reviewPhotosSection,
  'reviews/Snippet': () => reviewSnippetSection(),
  'reviews/Summary': () => reviewSummarySection(),
  'reviews/Questions': () => productQuestionsSection(),
}

/** Every Reviews app section type, in the Apps tab's order. */
export const REVIEWS_WIDGET_SECTIONS = Object.keys(BUILDERS) as (keyof ReviewsWidgetProps)[]

export function reviewsWidgetSections(
  loadReviews: ReviewsLoader | undefined,
): Record<keyof ReviewsWidgetProps, ComponentConfig> {
  return Object.fromEntries(
    REVIEWS_WIDGET_SECTIONS.map((k) => [k, BUILDERS[k](loadReviews)]),
  ) as Record<keyof ReviewsWidgetProps, ComponentConfig>
}
