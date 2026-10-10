/** Copy and defaults for Product features (sections/product-features.liquid). */
export const productFeaturesContent = {
  label: 'Product features',
  noProduct: 'Product features show on a product page. Preview a product to see them.',
  empty:
    'Add a feature: an image beside a heading and a short text. Connect the image or heading to a product metafield to vary it per product.',
  fields: {
    features: 'Features',
    image: 'Image',
    heading: 'Heading',
    text: 'Text',
    layout: 'Image side',
  },
  layouts: [
    { label: 'Alternate', value: 'auto' },
    { label: 'Image left', value: 'image-left' },
    { label: 'Image right', value: 'image-right' },
  ],
  /** The theme reads `custom.features`; nothing is typed in by default, so no product shows another's story. */
  features: [] as {
    image: { url: string; alt: string }
    heading: string
    text: string
    layout: string
  }[],
  newFeature: {
    image: { url: '', alt: '' },
    heading: 'Feature',
    text: '<p>What it does for the person using it.</p>',
    layout: 'auto',
  },
  imageSizes: '(min-width: 750px) 50vw, 100vw',
} as const
