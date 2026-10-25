/** Copy for the storefront search page, the header's predictive search and the 404 page. */
export const searchContent = {
  title: 'Search',
  titleFor: (q: string) => `Search: ${q}`,
  label: 'Search products',
  placeholder: 'Search products',
  submit: 'Search',
  clear: 'Clear search',
  results: (count: number, query: string) =>
    `${count} ${count === 1 ? 'result' : 'results'} for "${query}"`,
  promptTitle: 'What are you looking for?',
  promptBody: 'Search by product name, type, brand or SKU.',
  emptyTitle: (query: string) => `No results for "${query}"`,
  emptyBody: 'Check the spelling or try a more general word.',
  /** When the words as typed found nothing and their typo-corrected spelling did. */
  correctedTo: (corrected: string) => `Showing results for "${corrected}"`,
  searchInstead: (query: string) => `No results for "${query}".`,
  browseCollections: 'Browse collections',
  soldOut: 'Sold out',
  predictive: {
    products: 'Products',
    viewAll: (q: string) => `Search for "${q}"`,
    empty: (q: string) => `No products match "${q}"`,
    loading: 'Searching',
    /** Shown before the shopper types (the Header section's search settings). */
    popular: 'Popular searches',
    brands: 'Shop by brand',
  },
} as const

export const SEARCH_PER_PAGE = 24

/** Predictive search waits this long after the last keystroke before asking. */
export const PREDICTIVE_DEBOUNCE_MS = 200

export const notFoundContent = {
  searchPlaceholder: 'Search products…',
  title: 'Page not found',
  body: 'The page you were looking for does not exist.',
  cta: 'Continue shopping',
} as const
