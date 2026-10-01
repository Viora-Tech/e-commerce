/**
 * SOURCE OF TRUTH KEYWORDS: reviews copy, customer reviews section, spotlight review, rating stars
 * WHAT:  Every default and fixed UI string of the Customer reviews section (Puck key `Reviews`).
 * WHY:   Defaults come from Glide's templates/index.json (instance "reviews"), the liquid schema
 *        and locales (sections.reviews, reviews.*, products.rating). Like the theme's preset, the
 *        three starting reviews are empty: a review shows only once a real customer's name and
 *        words are filled in, so the store never ships invented reviews.
 * WHERE: `components/sections/glide/reviews*.tsx`, `components/rating-stars.tsx`,
 *        `sections/glide/reviews.tsx`.
 */
export const reviewsContent = {
  label: 'Customer reviews',
  kicker: '',
  heading: 'What customers say',
  bodyLines: 6,
  writeLabel: 'Write a review',
  writeUrl: '/pages/reviews',
  verifiedBuyer: 'Verified buyer',
  productReviewed: 'Product reviewed:',
  editorEmpty:
    "No reviews to show yet. Add a review and fill in the customer's name and their words.",
  ratingLabel: (rating: string) => `Rated ${rating} out of 5 stars`,
  outOf: (rating: string, max: number) => `${rating} / ${max}`,
  fields: {
    honesty:
      'Every review must be a real quote from a real customer, published with their permission.',
    kicker: 'Small line above the heading',
    heading: 'Heading',
    bodyLines: 'Lines before a long review is trimmed',
    aggregateRating: 'Average rating (a number out of 5, blank hides the stars)',
    aggregateText: 'Line beside the average (e.g. "from 214 verified reviews")',
    writeLabel: 'Write a review button',
    writeUrl: 'Write a review link (blank hides the button)',
    reviews: 'Reviews',
    review: 'Review',
    name: 'Customer name',
    body: 'What they said',
    rating: 'Stars',
    noRating: 'No rating',
    product: 'Product reviewed (handle, optional)',
    date: 'Date (shown as typed, e.g. March 2026)',
    verified: 'Verified buyer (only if you can confirm their order)',
    photo: 'Customer photo (optional)',
    yes: 'Yes',
    no: 'No',
  },
} as const
