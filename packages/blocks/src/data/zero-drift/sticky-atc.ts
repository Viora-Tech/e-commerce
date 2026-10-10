/** Copy and defaults for the sticky add-to-cart bar (sections/sticky-atc.liquid). */
export const stickyAtcContent = {
  label: 'Sticky add to cart',
  placementLabel: 'Desktop position (phones always get a full-width bar)',
  placements: [
    { label: 'Card in the bottom corner', value: 'corner' },
    { label: 'Full-width bar', value: 'bar' },
  ],
  addLabelField: 'Button label',
  soldOutLabelField: 'Sold out label',
  defaults: {
    placement: 'corner',
    addLabel: 'Add to cart',
    soldOutLabel: 'Sold out',
  },
  added: 'Added',
  noProduct: 'The sticky add-to-cart bar shows on product pages. Preview a product to see it.',
}
