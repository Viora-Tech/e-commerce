/**
 * Copy for the Search & discovery app's Overview, Boosts and Recommendations pages: what
 * shoppers search and click, pinned and boosted products, and hand-picked recommendations.
 * Plain words.
 */
export const searchDiscoveryContent = {
  overview: {
    title: 'Overview',
    summary:
      'What shoppers search for on your store, what they click, and how your product recommendations do. Counted only for shoppers who allow analytics.',
    period: 'Period',
    periods: { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days' } as Record<
      number,
      string
    >,
    vsBefore: 'vs the period before',
    funnel: {
      title: 'Search funnel',
      sessions: 'Search sessions',
      clicked: 'Clicked a result',
      added: 'Added to cart',
      checkedOut: 'Placed an order',
      ofSessions: (rate: string) => `${rate} of search sessions`,
      note: 'A click, add or order counts when it comes within 30 minutes of the step before.',
    },
    top: {
      title: 'Top searches',
      empty: 'No searches yet in this period.',
    },
    noResults: {
      title: 'Searches with no results',
      empty: 'Every search found something. Nice.',
    },
    noClicks: {
      title: 'Searches with no clicks',
      empty: 'Shoppers clicked a result for every search that found products.',
    },
    columns: {
      search: 'Search',
      searches: 'Searches',
      results: 'Results',
      clickRate: 'Click rate',
      action: 'Fix',
    },
    addSynonym: 'Add synonym',
    pinProduct: 'Pin a product',
    recommendations: {
      title: 'Recommendations',
      intent: 'Row',
      impressions: 'Times seen',
      clicks: 'Clicks',
      adds: 'Added to cart',
      clickRate: 'Click rate',
      empty: 'No recommendation rows seen yet in this period.',
    },
    intents: { related: 'You may also like', complementary: 'Pairs well with' },
    loadFailed: 'Could not load the numbers. Try again.',
    retry: 'Try again',
  },
  boosts: {
    title: 'Boosts',
    summary:
      'Put the right products first in search results: pin products to a search, or move products up or down by tag, type or vendor.',
    pins: {
      title: 'Pinned products',
      description:
        'For one search, these products show first, in this order, even when the words would not find them.',
      add: 'Pin products',
      empty: 'No pinned products yet.',
      edit: 'Edit',
      remove: 'Remove pins',
      removed: 'Pins removed',
      products: (n: number) => (n === 1 ? '1 product' : `${n} products`),
    },
    pinDialog: {
      title: 'Pin products to a search',
      term: 'Search',
      termHelp: 'Matched however the shopper types it: capitals, extra spaces and a question mark do not matter.',
      termPlaceholder: 'wireless keyboard',
      products: 'Products, in order',
      choose: 'Choose products',
      noProducts: 'No products chosen yet.',
      moveUp: 'Move up',
      moveDown: 'Move down',
      removeProduct: 'Remove',
      limit: (max: number) => `Up to ${max} products.`,
      save: 'Save pins',
      saved: 'Pins saved',
      cancel: 'Cancel',
    },
    rules: {
      title: 'Boost and bury',
      description:
        'Boosted products move up in every search; buried ones go to the end. Matched exactly as the product has it.',
      field: 'Products with',
      fields: { tag: 'Tag', type: 'Product type', vendor: 'Vendor' },
      value: 'Value',
      valuePlaceholder: 'Choose or type a value',
      action: 'Do',
      actions: { boost: 'Boost', bury: 'Bury' },
      add: 'Add rule',
      remove: 'Remove rule',
      empty: 'No rules yet. Search ranks by how well each product matches.',
      limit: (max: number) => `Up to ${max} rules.`,
      save: 'Save rules',
      saved: 'Rules saved',
    },
  },
  recommendations: {
    title: 'Recommendations',
    summary:
      'Choose the products that show under a product: “You may also like” and “Pairs well with”. Your picks show first; the store fills the rest by itself.',
    listTitle: 'Products with picks',
    empty: 'No picks yet. Every product shows automatic recommendations until you choose some.',
    choose: 'Choose a product',
    columns: { product: 'Product', related: 'You may also like', complementary: 'Pairs well with' },
    edit: 'Edit',
  },
  editor: {
    title: (product: string) => `Recommendations for ${product}`,
    back: 'Recommendations',
    summary: 'Your picks show first, in this order. Automatic ones fill the row after them.',
    rows: {
      related: {
        title: 'You may also like',
        description: 'Products like this one: other colours, sizes or similar items.',
      },
      complementary: {
        title: 'Pairs well with',
        description: 'Products bought with this one: add-ons, accessories, refills.',
      },
    },
    add: 'Add products',
    empty: 'No picks. This row shows automatic recommendations.',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    limit: (max: number) => `Up to ${max} products.`,
    save: 'Save',
    saved: 'Recommendations saved',
    draft: 'Draft',
    archived: 'Archived',
    notFound: 'This product could not be found.',
  },
  failed: 'Could not save. Try again.',
} as const
