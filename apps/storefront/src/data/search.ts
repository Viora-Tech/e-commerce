/** Copy for the storefront search page and the 404 page. */
export const searchContent = {
  title: 'Search',
  label: 'Search products',
  placeholder: 'Search',
  submit: 'Search',
  results: (count: number, query: string) =>
    `${count} ${count === 1 ? 'result' : 'results'} for "${query}"`,
  empty: 'No products match your search.',
} as const

export const notFoundContent = {
  title: 'Page not found',
  body: 'The page you were looking for does not exist.',
  cta: 'Continue shopping',
} as const
