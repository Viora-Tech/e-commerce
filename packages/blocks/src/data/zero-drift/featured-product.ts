/**
 * SOURCE OF TRUTH KEYWORDS: featured product copy, featured lockup, single product buy box
 * WHAT:  Every default and fixed UI string of the Featured product section (Puck key
 *        `FeaturedProduct`). The lockup's own strings (share, help, view details) are the
 *        Featured carousel's, since both draw the same lockup.
 * WHY:   Defaults come from Glide's templates/index.json (instance "featured_product") and the
 *        liquid schema (sections.featured_product). The theme's product is a real Glide product,
 *        so the handle starts empty here.
 * WHERE: `components/sections/zero-drift/featured-product.tsx`, `sections/zero-drift/featured-product.tsx`.
 */
export const featuredProductContent = {
  label: 'Featured product',
  eyebrow: 'Featured',
  stampText: 'PRODUCT • FEATURED •',
  empty: 'Pick a product.',
  fields: {
    handle: 'Product handle',
    imageSide: 'Picture side',
    left: 'Left',
    right: 'Right',
    eyebrow: 'Small heading above the title',
    text: 'Short description (optional)',
    button: 'Button label (blank uses "Shop now")',
    showStamp: 'Show the spinning stamp',
    stampText: 'Stamp text',
    showShare: 'Show share links',
    showHelp: 'Show "Need help?" link',
    helpLink: 'Need help link address',
    yes: 'Yes',
    no: 'No',
  },
} as const
