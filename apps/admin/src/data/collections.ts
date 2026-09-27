import type { CollectionField, CollectionOp, CollectionSort } from '@commerce/core/collections'

/** Frame 5:3936 "Categories": every string the collections screens show. */
export const collectionsListContent = {
  title: 'Collections',
  heading: 'Discover',
  add: 'Add product',
  moreActions: 'More actions',
  newCollection: 'New collection',
  allCollections: 'All collections',
  searchProducts: 'Search your product',
  searchCollections: 'Search collections',
  allProducts: 'All products',
  clearFilter: 'Show every product',
  filteredBy: (title: string) => `Showing ${title}`,
  tabs: {
    all: 'All products',
    featured: 'Featured products',
    onSale: 'On sale',
    outOfStock: 'Out of stock',
  },
  columns: {
    no: 'No.',
    product: 'Product',
    created: 'Created date',
    order: 'Stock',
    action: 'Action',
  },
  rowActions: { edit: 'Edit product', remove: 'Delete product' },
  empty: {
    heading: 'No products here yet',
    body: 'Products you add to this collection appear in this table.',
  },
  noCollections: {
    heading: 'No collections yet',
    body: 'Group products into collections so shoppers can browse by type, brand or season.',
    action: 'Create collection',
  },
  tiles: {
    total: 'Collections',
    automatic: 'Automatic',
    manual: 'Manual',
    empty: 'Empty',
    period: 'All time',
  },
  resource: { singular: 'product', plural: 'products' },
  nextPage: 'Show more collections',
  previousPage: 'Show previous collections',
} as const

export const collectionFormContent = {
  newTitle: 'Create collection',
  editTitle: 'Edit collection',
  back: 'Collections',
  save: 'Save',
  saving: 'Saving',
  discard: 'Discard',
  unsaved: 'Unsaved changes',
  saved: 'Collection saved',
  created: 'Collection created',
  deleted: 'Collection deleted',
  saveFailed: 'Could not save the collection',
  details: {
    heading: 'Details',
    title: 'Title',
    titlePlaceholder: 'Mousepads',
    description: 'Description',
    image: 'Collection image',
    pickImage: 'Choose image',
    changeImage: 'Replace',
    removeImage: 'Remove',
    noImage: 'No image chosen',
  },
  kind: {
    heading: 'Products',
    manual: 'Manual',
    manualHelp: 'Add products one by one and drag them into the order shoppers see.',
    automatic: 'Automatic',
    automaticHelp: 'Products matching these conditions are added and removed for you.',
    preview: (n: number) => `${n} ${n === 1 ? 'product matches' : 'products match'}`,
    previewing: 'Counting products',
  },
  products: {
    heading: 'Products in this collection',
    search: 'Search products to add',
    add: 'Add',
    remove: 'Remove',
    empty: 'No products yet. Search above to add the first one.',
    moveUp: 'Move up',
    moveDown: 'Move down',
    count: (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`,
  },
  sort: {
    heading: 'Sort order',
    help: 'How products are ordered on the storefront.',
  },
  seo: {
    heading: 'Search engine listing',
    title: 'Page title',
    description: 'Meta description',
  },
  status: {
    heading: 'Status',
    help: 'Draft collections are hidden from the storefront.',
    active: 'Active',
    draft: 'Draft',
  },
  delete: {
    action: 'Delete collection',
    heading: 'Delete this collection?',
    body: 'The products stay in your catalogue. Only the grouping is removed.',
    confirm: 'Delete',
    cancel: 'Keep it',
  },
} as const

export const SORT_LABELS: Record<CollectionSort, string> = {
  manual: 'Manual order',
  title_asc: 'Title A to Z',
  title_desc: 'Title Z to A',
  price_asc: 'Price low to high',
  price_desc: 'Price high to low',
  created_desc: 'Newest first',
}

export const FIELD_LABELS: Record<CollectionField, string> = {
  title: 'Product title',
  type: 'Product type',
  vendor: 'Vendor',
  tag: 'Tag',
  price: 'Price',
}

export const OP_LABELS: Record<CollectionOp, string> = {
  eq: 'is equal to',
  neq: 'is not equal to',
  contains: 'contains',
  starts_with: 'starts with',
  gt: 'is greater than',
  lt: 'is less than',
}

/** Product organisation card. */
export const productCollectionsContent = {
  label: 'Collections',
  help: 'Manual collections this product belongs to.',
  none: 'Not in any collection',
  placeholder: 'Add to a collection',
} as const

/** Standalone collections card on the product form (frame: organisation). */
export const productCollectionsCardContent = {
  heading: 'Collections',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Collections updated',
  failed: 'Could not update collections',
  saveFirst: 'Save the product first, then add it to collections.',
  automaticLabel: 'Added automatically',
  automaticHelp: 'Smart collections whose rules match this product.',
  automaticNone: 'Not added to any smart collection yet.',
} as const
