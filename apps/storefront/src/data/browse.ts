import type { BrowseSort } from '@commerce/core/browse'

/** Copy for collection and search listings: filters, sort, chips and paging. */
export const browseContent = {
  filterAndSort: 'Filter and sort',
  filters: 'Filters',
  collections: 'Collections',
  apply: 'Apply',
  clearAll: 'Clear all',
  close: 'Close',
  sortLabel: 'Sort by',
  showResults: (n: number) => `Show ${n} ${n === 1 ? 'result' : 'results'}`,
  productCount: (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`,
  availability: 'Availability',
  inStock: 'In stock',
  kind: 'Type of item',
  kindProducts: 'Products',
  kindGiftCards: 'Gift cards',
  outOfStock: 'Out of stock',
  price: 'Price',
  priceFrom: 'From',
  priceTo: 'To',
  priceRange: (max: string) => `The highest price is ${max}`,
  productType: 'Product type',
  vendor: 'Brand',
  tag: 'Tags',
  /** A yes/no extra field's filter values (`1`, `0`). */
  yes: 'Yes',
  no: 'No',
  chip: {
    available: (v: string) => (v === 'true' ? 'In stock' : 'Out of stock'),
    giftCard: (v: string) => (v === 'true' ? 'Gift cards' : 'Products only'),
    price: (min: string | null, max: string | null) =>
      min && max ? `${min} to ${max}` : min ? `From ${min}` : `Up to ${max}`,
    remove: (label: string) => `Remove filter ${label}`,
  },
  previous: 'Previous',
  next: 'Next',
  pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
  noMatchesTitle: 'No products match these filters',
  noMatchesBody: 'Try removing a filter or two.',
} as const

export const SORT_LABELS: Record<BrowseSort, string> = {
  manual: 'Featured',
  relevance: 'Relevance',
  'best-selling': 'Best selling',
  'title-ascending': 'Alphabetically, A to Z',
  'title-descending': 'Alphabetically, Z to A',
  'price-ascending': 'Price, low to high',
  'price-descending': 'Price, high to low',
  'created-descending': 'Date, new to old',
}

export const COLLECTION_SORTS: BrowseSort[] = [
  'manual',
  'best-selling',
  'title-ascending',
  'title-descending',
  'price-ascending',
  'price-descending',
  'created-descending',
]

export const SEARCH_SORTS: BrowseSort[] = [
  'relevance',
  'best-selling',
  'price-ascending',
  'price-descending',
  'created-descending',
]
