/** Copy and defaults for Product reviews (sections/product-reviews.liquid). */
export const productReviewsContent = {
  label: 'Product reviews',
  heading: 'Reviews',
  /**
   * There is no reviews store yet (the theme embedded the Judge.me app block), so the
   * section shows this empty state until one exists.
   */
  text: '<p>No reviews yet. Bought this? Tell other buyers how it went.</p>',
  noProduct: 'Product reviews show on a product page. Preview a product to see them.',
  empty: 'Product reviews show on a product page.',
  fields: { heading: 'Heading', text: 'Text while there are no reviews' },
} as const
