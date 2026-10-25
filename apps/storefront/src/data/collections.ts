/** Every string the storefront collection pages show. */
export const collectionsContent = {
  indexTitle: 'Collections',
  indexIntro: 'Browse the range by category.',
  empty: 'Nothing in this collection yet.',
  emptyIndex: 'No collections yet.',
  productCount: (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`,
  all: 'All collections',
  /** The header's first link on a store with no menu yet. */
  shopAll: 'Shop all',
  /** The footer's columns on a store with no footer menu yet. */
  starterFooter: {
    shop: 'Shop',
    help: 'Help',
    search: 'Search',
    trackOrder: 'Track your order',
    account: 'Your account',
  },
} as const

export const COLLECTION_PER_PAGE = 24
