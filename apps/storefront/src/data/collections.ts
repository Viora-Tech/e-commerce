import type { CollectionSort } from '@commerce/core/collections'

/** Every string the storefront collection pages show. */
export const collectionsContent = {
  indexTitle: 'Collections',
  indexIntro: 'Browse the range by category.',
  empty: 'Nothing in this collection yet.',
  emptyIndex: 'No collections yet.',
  productCount: (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`,
  sortLabel: 'Sort by',
  previous: 'Previous',
  next: 'Next',
  pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
  all: 'All collections',
} as const

/** Sorts a shopper can pick; the merchant's own order is the default. */
export const SORT_OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: 'manual', label: 'Featured' },
  { value: 'title_asc', label: 'Alphabetically, A to Z' },
  { value: 'title_desc', label: 'Alphabetically, Z to A' },
  { value: 'price_asc', label: 'Price, low to high' },
  { value: 'price_desc', label: 'Price, high to low' },
  { value: 'created_desc', label: 'Newest first' },
]

export const COLLECTION_PER_PAGE = 24
