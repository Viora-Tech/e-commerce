/** Every string the storefront collection pages show. */
export const collectionsContent = {
  indexTitle: 'Collections',
  indexIntro: 'Browse the range by category.',
  empty: 'Nothing in this collection yet.',
  emptyIndex: 'No collections yet.',
  productCount: (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`,
  all: 'All collections',
} as const

export const COLLECTION_PER_PAGE = 24
