/** Copy and defaults for the Size guide (sections/product-size-guide.liquid, values from templates/product.json). */
export const productSizeGuideContent = {
  label: 'Size guide',
  noProduct: 'The size guide shows on a product page. Preview a product to see it.',
  /** `products.size_guide.empty`, with what to do about it. */
  empty:
    'No size guide set up yet. Type one size per line, or connect the rows to a multi-line product metafield.',
  heading: 'Size guide',
  measureLabel: 'Ideal hand size',
  measureUnit: 'cm',
  dimsLabel: 'Dimensions',
  tagsLabel: 'Grip style',
  weightLabel: 'Weight',
  note: "Size recommendations are a guide only. They are worked out from each shell's length, not published by the manufacturer, so choose on your own hand shape, grip style and preference.",
  bestMatch: 'Best match',
  fields: {
    heading: 'Heading',
    rows: 'Sizes: "Name | Dimensions | 17.0 - 18.5 | Tags | Weight" per line (or connect a multi-line metafield)',
    measureLabel: 'Measurement (the slider matches it)',
    measureUnit: 'Measurement unit',
    dimsLabel: 'Second column',
    tagsLabel: 'Fourth column',
    weightLabel: 'Fifth column',
    note: 'Note under the cards',
  },
  /** Empty, so no product shows another product's sizes. */
  rows: '',
} as const
