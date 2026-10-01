/** Default copy and fixed UI strings for the Drop reveal section (Glide `drop-reveal`). */
export const dropRevealContent = {
  label: 'Drop reveal',
  collectionHandle: 'preorder',
  heading: 'Straight out of the box',
  subheading: 'Just landed in India. In stock and ready to ship.',
  ctaLabel: 'Shop the drop',
  ribbonLabel: '',
  productCount: 6,
  emptyText: 'Pick a collection with products to see the drop.',
  fields: {
    collectionHandle: 'Collection handle (the products that come out of the box)',
    productCount: 'Products shown (4-8)',
    heading: 'Heading',
    subheading: 'Text under the heading',
    ctaLabel: 'Button label',
    ctaLink: 'Button link (blank = the collection page)',
    showRibbon: 'Gift ribbon on the box',
    ribbonLabel: 'Ribbon tag (e.g. Today only)',
    markImage: 'Logo printed on the box front (optional)',
  },
  yesNo: [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ],
} as const

/**
 * Scrub timing, ported from assets/drop-reveal.js.
 * `smoothing` is the fraction of the remaining distance closed per frame (about 6 frames to settle).
 * `slotFactor` must match the 0.72 slot the box artwork in section-drop-reveal.css assumes.
 */
export const DROP_REVEAL = {
  desktopQuery: '(min-width: 750px)',
  reducedQuery: '(prefers-reduced-motion: reduce)',
  smoothing: 0.18,
  slotFactor: 0.72,
  resizeDelayMs: 150,
  entryThreshold: 0.15,
  entryMargin: '0px 0px -40px 0px',
  activeMargin: '200px 0px',
  idleDelta: 0.0002,
  minProducts: 4,
  maxProducts: 8,
} as const
