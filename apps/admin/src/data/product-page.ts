/** Product page copy for what installed apps add (the More tab, More actions) and the share preview. */
export const productPageContent = {
  /** The More tab: one section per installed app that adds something to products. */
  apps: {
    openApp: 'Open app',
    unsaved: 'Save the product to see what your apps add to it.',
    emptyHeading: 'No app adds anything here yet',
    emptyBody:
      'Apps like Reviews, Back in stock and GST invoices add their own sections to every product. Install one and it shows up here.',
    browse: 'Browse the App Store',
    failed: 'Could not load this section.',
  },
  /** "Apps" group in the product's More actions menu. */
  actions: {
    archive: 'Archive product',
    unarchive: 'Unarchive product',
    viewReviews: 'View reviews for this product',
    backInStock: 'See who is waiting for this product',
    editGst: 'Edit HSN code and GST rate',
    searchPerformance: 'View Google search performance',
  },
  reviews: {
    count: (n: number) => (n === 1 ? '1 review' : `${n} reviews`),
    empty: 'No reviews for this product yet.',
    anonymous: 'Anonymous',
    viewAll: 'View all reviews',
  },
  backInStock: {
    waiting: (n: number) =>
      n === 1 ? '1 shopper waiting for a restock' : `${n} shoppers waiting for a restock`,
    pending: (n: number) => `${n} not yet confirmed`,
    empty: 'Nobody has asked to be told when this product is back.',
    variantWaiting: (n: number) => `${n} waiting`,
    viewAll: 'View all requests',
  },
  gst: {
    hsCode: 'HSN code',
    gstRate: 'GST rate',
    notSet: 'Not set',
    storeRate: 'Store rate',
    rate: (n: string) => `${n}%`,
    help: 'Printed on every GST invoice for this product.',
    edit: 'Edit on Shipping',
  },
  /** Search tab: how a link to the product looks when shared on WhatsApp, Facebook or X. */
  social: {
    heading: 'Social share preview',
    google: 'Google',
    imageHelp:
      'Shared links use the product’s main image. To change it, make another photo the first one on Overview.',
    noImage: 'Add a photo on Overview so shared links show a picture.',
  },
  checklist: {
    apps: (n: number) => (n === 1 ? '1 app' : `${n} apps`),
    noApps: 'No apps',
  },
} as const
