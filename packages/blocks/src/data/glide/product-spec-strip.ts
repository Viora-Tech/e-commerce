/** Copy and defaults for the Spec strip (sections/product-spec-strip.liquid). */
export const productSpecStripContent = {
  label: 'Spec strip',
  heading: 'At a glance',
  noProduct: 'The spec strip shows on a product page. Preview a product to see it.',
  empty:
    'Type a value for each spec, or connect it to a product metafield. Specs with no value are left out.',
  fields: {
    heading: 'Heading (optional)',
    items: 'Specs',
    label: 'Label (the small line, e.g. Weight)',
    value: 'Value (the big number, e.g. 38), or connect a metafield',
    unit: 'Unit (optional, e.g. g or Hz)',
  },
  /** The theme's preset: two labelled specs with no values, so no product shows another's numbers. */
  items: [
    { label: 'Weight', value: '', unit: 'g' },
    { label: 'Polling rate', value: '', unit: 'Hz' },
  ],
  newItem: { label: 'Spec', value: '', unit: '' },
  maxItems: 6,
} as const
