/**
 * SOURCE OF TRUTH KEYWORDS: tabbed products copy, product grid tabs, TABBED_PRODUCTS
 * WHAT:  Every default and fixed UI string of the Tabbed products section (Puck key
 *        `ProductGrid`, component `TabbedProducts`), plus its motion timing.
 * WHY:   Defaults come from Glide's templates/index.json (instance "tabbed-products"), the
 *        liquid schema and locales (sections.tabbed_products). The theme's tabs name the
 *        owner's own collections, so the default here is one "All" tab that works in any store.
 * WHERE: `components/product-grid.tsx`, `components/tabbed-products-*.tsx`,
 *        `sections/glide/tabbed-products.tsx`.
 */
export const tabbedProductsContent = {
  label: 'Tabbed product grid',
  heading: 'Shop the range',
  allTab: 'All',
  viewAll: 'View all',
  empty: 'Nothing in this collection yet.',
  allHref: '/collections/all',
  fields: {
    heading: 'Heading',
    headingAlignment: 'Heading and tabs position',
    left: 'Left',
    center: 'Center',
    showTabCounts: 'Show product counts on the tabs',
    headingFollowsTab: 'Heading rolls to the chosen tab',
    columns: 'Columns',
    rows: 'Rows',
    tabs: 'Tabs',
    tab: 'Tab',
    label: 'Tab name (blank uses the collection name)',
    collection: 'Collection handle (blank shows every product)',
    productType: 'Product type (older tabs; blank = all)',
    limit: 'Products (older tabs)',
    yes: 'Yes',
    no: 'No',
  },
} as const

/** Behaviour from assets/tabbed-products.js. */
export const TABBED_PRODUCTS = {
  /** The heading odometer: base duration plus a step per name travelled, capped. */
  rollBaseMs: 260,
  rollStepMs: 130,
  rollMaxMs: 760,
} as const
