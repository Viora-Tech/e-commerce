/** Frame "Dialog · Select products" (295:11538): the shared product picker. */
export const selectProductsContent = {
  title: 'Select products',
  /** A variant listed without a price yet (#913). */
  noPrice: 'No price yet',
  search: 'Search products',
  searchLabel: 'Search products by name or SKU',
  collection: 'Collection',
  productType: 'Product type',
  status: 'Status',
  anyCollection: 'All collections',
  anyType: 'All types',
  anyStatus: 'Any status',
  statuses: { active: 'Active', draft: 'Draft' },
  showSelectedOnly: 'Show selected only',
  empty: 'No products match',
  emptySelected: 'Nothing selected yet',
  failed: 'Could not load products',
  retry: 'Try again',
  inStock: (n: number) => `${n} in stock`,
  outOfStock: 'Out of stock',
  variantCount: (n: number) => `${n} ${n === 1 ? 'variant' : 'variants'}`,
  alreadyAdded: 'Already added',
  expand: 'Show variants',
  collapse: 'Hide variants',
  summary: (products: number, variants: number) =>
    `${products} ${products === 1 ? 'product' : 'products'} · ${variants} ${
      variants === 1 ? 'variant' : 'variants'
    } selected`,
  productsOnly: (products: number) =>
    `${products} ${products === 1 ? 'product' : 'products'} selected`,
  cancel: 'Cancel',
  add: (n: number) => (n === 0 ? 'Add products' : `Add ${n} ${n === 1 ? 'product' : 'products'}`),
} as const
