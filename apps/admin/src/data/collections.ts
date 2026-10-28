import type { CollectionField, CollectionOp, CollectionSort } from '@commerce/core/collections'

/** Frame 5:3936 "Categories": every string the collections screens show. */
export const collectionsListContent = {
  title: 'Collections',
  summary: (total: number, automatic: number, empty: number) =>
    [
      `${total} ${total === 1 ? 'collection' : 'collections'}`,
      `${automatic} automatic`,
      `${empty} empty`,
    ].join(' · '),
  list: {
    tiles: {
      all: 'All collections',
      allNote: 'All time',
      automatic: 'Automatic',
      automaticNote: 'Rule based',
      manual: 'Manual',
      manualNote: 'Hand picked',
      empty: 'Empty',
      emptyNote: 'Nothing inside yet',
    },
    tabs: { all: 'All', automatic: 'Automatic', manual: 'Manual', empty: 'Empty' },
    filters: {
      image: 'Has image',
      minProducts: 'At least',
      maxProducts: 'At most',
      anyDate: 'Any time',
      updatedOptions: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' },
    },
    resource: { singular: 'collection', plural: 'collections' },
    search: 'Search collections',
    columns: {
      collection: 'Collection',
      products: 'Products',
      type: 'Type',
      visibility: 'Visibility',
      updated: 'Updated',
    },
    kind: { manual: 'Manual', automatic: 'Automatic' },
    visibility: { active: 'Online store', draft: 'Hidden' },
    ruleField: {
      title: 'Title',
      type: 'Type',
      vendor: 'Vendor',
      tag: 'Tag',
      price: 'Price',
    },
    ruleOp: {
      eq: 'is',
      neq: 'is not',
      contains: 'contains',
      starts_with: 'starts with',
      gt: '>',
      lt: '<',
    },
    row: {
      open: 'Open',
      edit: 'Edit collection',
      viewOnStore: 'View on store',
      delete: 'Delete collection',
    },
    bulk: {
      delete: 'Delete',
      title: (n: number) => `Delete ${n} collection${n === 1 ? '' : 's'}?`,
      body: 'The products stay in your catalogue. Only the groupings are removed.',
      confirm: 'Delete',
      cancel: 'Keep them',
    },
    noRules: 'No conditions yet',
    deleted: 'Collection deleted',
    deleteFailed: 'Could not delete the collection',
    empty: {
      heading: 'No collections match',
      body: 'Try another search or tab.',
    },
  },
  heading: 'Discover',
  add: 'Add product',
  moreActions: 'More actions',
  newCollection: 'Create collection',
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

/** Frames "Collection / Detail" (manual 293:22374, automatic 293:20872): card and column copy. */
export const collectionDetailContent = {
  back: 'Collections',
  preview: 'Preview',
  more: 'More actions',
  newTitle: 'New collection',
  summary: (products: number, updated: string | null) =>
    [
      `${products} ${products === 1 ? 'product' : 'products'}`,
      updated ? `Updated ${updated}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  newSummary: 'Give it a name, then choose how products get in.',
  titleCard: 'Title and description',
  image: {
    heading: 'Collection image',
    replace: 'Replace',
    add: 'Add image',
    remove: 'Remove image',
    none: 'No image yet',
  },
  visibility: {
    heading: 'Visibility',
    chipOn: 'Online store',
    chipOff: 'Hidden',
    label: 'Online store',
    help: 'Shoppers can browse this collection',
    helpOff: 'Hidden from shoppers',
  },
  type: {
    heading: 'Collection type',
    manual: 'Manual',
    manualHelp: 'You pick each product and set the order.',
    automatic: 'Automatic',
    automaticHelp: 'Products are added when they match your rules.',
    locked: 'The type is locked after you create the collection.',
    choose: 'Choose how products get into this collection.',
  },
  seo: {
    heading: 'Search engine listing',
    edit: 'Edit',
    done: 'Done',
    fallback: 'Add a title and description to see how this page may appear in search.',
  },
  conditions: {
    heading: 'Conditions',
    help: 'Products that match these rules are added automatically.',
    mustMatch: 'Products must match',
    all: 'all conditions',
    any: 'any condition',
    add: 'Add another condition',
    remove: 'Remove condition',
    matches: (n: number) => `${n} ${n === 1 ? 'product matches' : 'products match'}`,
    counting: 'Counting products',
  },
  products: {
    heading: 'Products in this collection',
    add: 'Add products',
    search: 'Search in this collection',
    sort: 'Sort',
    columns: { product: 'Product', status: 'Status', stock: 'Stock', price: 'Price' },
    inStock: (n: number) => `${n} in stock`,
    outOfStock: 'Out of stock',
    open: 'Open product',
    remove: 'Remove from collection',
    reorder: 'Drag to reorder',
    emptyManual: 'No products yet',
    emptyManualBody: 'Add products to build this collection.',
    emptyAutomatic: 'No products match yet',
    emptyAutomaticBody: 'Products appear here once they match your conditions.',
    emptySearch: 'No products match your search',
    automaticNote: 'Saved collections update on their own when products change.',
    sortLabels: {
      instructions:
        'Press space to pick up a product, arrow keys to move it, space again to drop it.',
      handle: (title: string) => `Move ${title}`,
      picked: (title: string) => `Picked up ${title}`,
      moved: (title: string, position: number, total: number) =>
        `${title} moved to position ${position} of ${total}`,
      dropped: (title: string, position: number, total: number) =>
        `${title} dropped at position ${position} of ${total}`,
      cancelled: (title: string) => `Move of ${title} cancelled`,
    },
  },
} as const
