import type { ProductStatus } from '@commerce/core/catalog'
import { parseRupees } from '@commerce/money'
import { routes } from '@/lib/routes'

/** Stock levels the product list filters by (`?stock=`); defined once in core. */
export type { StockFilter } from '@commerce/core/catalog'

export const PRODUCT_STATUSES = ['active', 'draft', 'archived'] as const

/** Every string the products list shows. */
export const productsListContent = {
  row: {
    openNewTab: 'Open in a new tab',
    edit: 'Edit product',
    inventory: 'Adjust inventory',
  },
  title: 'Products',
  /* Same frame family as the order list (5:2353): heading, primary action, tab group. */
  heading: 'Product list',
  resource: { singular: 'product', plural: 'products' },
  add: 'Add product',
  export: 'Export',
  import: 'Import',
  tabs: { all: 'All products' },
  summary: (total: number, low: number, out: number) =>
    [
      `${total} ${total === 1 ? 'product' : 'products'}`,
      low > 0 ? `${low} low on stock` : null,
      out > 0 ? `${out} out of stock` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  tiles: {
    total: 'Total products',
    low: 'Low stock',
    out: 'Out of stock',
    draft: 'Draft',
    totalNote: 'Active, draft and archived',
    lowNote: '5 or fewer left',
    outNote: 'Not on sale until restocked',
    draftNote: 'Hidden until you publish',
  },
  filters: {
    label: 'Filters',
    vendor: 'Vendor',
    productType: 'Product type',
    tag: 'Tag',
    stock: 'Stock',
    collection: 'Collection',
    price: 'Price',
    priceMin: 'Min price',
    priceMax: 'Max price',
    created: 'Created',
    anyDate: 'Any date',
    createdOptions: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' },
    any: 'Any',
    stockOptions: [
      { value: 'in', label: 'In stock' },
      { value: 'low', label: 'Low stock' },
      { value: 'out', label: 'Out of stock' },
    ],
    missing: 'Missing',
    missingOptions: [
      { value: 'weight', label: 'No weight' },
      { value: 'image', label: 'No image' },
      { value: 'price', label: 'Price (₹0 on store)' },
    ],
  },
  status: { active: 'Active', draft: 'Draft', archived: 'Archived' } satisfies Record<
    ProductStatus,
    string
  >,
  columns: {
    product: 'Product',
    status: 'Status',
    inventory: 'Inventory',
    type: 'Type',
    vendor: 'Vendor',
    price: 'Price',
  },
  /** The sort menu (Figma "State · Sort open", 626:148698). */
  sortTitles: { product: 'Product title', type: 'Product type' },
  sortAlpha: { desc: 'Z to A', asc: 'A to Z', first: 'asc' as const },
  inventory: (available: number, variants: number) =>
    `${available} in stock for ${variants} variant${variants === 1 ? '' : 's'}`,
  inStock: (available: number) =>
    available < 0 ? `Oversold by ${-available}` : `${available} in stock`,
  variants: (n: number) => `${n} variant${n === 1 ? '' : 's'}`,
  none: '',
  priceRange: (min: string, max: string) => `${min} to ${max}`,
  preorderPill: 'Pre-order',
  launching: (date: Date) =>
    `Launching ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
  bulk: {
    bulkEdit: 'Bulk edit',
    setActive: 'Set as active',
    setDraft: 'Set as draft',
    archive: 'Archive',
    addTag: 'Add tag',
    delete: 'Delete',
    exportSelected: 'Export',
    addToCollection: 'Add to collection',
    /** The selection header's ⋯ menu: the less common bulk actions. */
    more: 'More bulk actions',
    collection: {
      title: 'Add to collection',
      label: 'Collection',
      help: (n: number) =>
        `The ${n} selected product${n === 1 ? '' : 's'} join this collection. Automatic collections fill themselves, so only manual ones are listed.`,
      loading: 'Loading collections',
      none: 'No manual collections yet. Create one under Collections first.',
      apply: 'Add',
      cancel: 'Cancel',
    },
    tagPrompt: 'Tag to add',
    tagPlaceholder: 'summer',
    tagHelp: (n: number) =>
      `Added to the ${n} selected product${n === 1 ? '' : 's'}. Their other tags stay.`,
    apply: 'Apply',
    cancel: 'Cancel',
    updated: (n: number) => `${n} product${n === 1 ? '' : 's'} updated`,
    tagged: (n: number, tag: string) => `${tag} added to ${n} product${n === 1 ? '' : 's'}`,
    removed: (deleted: number, archived: number) =>
      archived === 0
        ? `${deleted} product${deleted === 1 ? '' : 's'} deleted`
        : `${deleted} deleted, ${archived} archived because they have orders`,
    failed: 'Could not update products',
    confirmDelete: {
      title: (n: number) => `Delete ${n} product${n === 1 ? '' : 's'}?`,
      body: 'This cannot be undone. Products with orders are archived instead so history stays intact.',
      confirm: 'Delete',
      cancel: 'Cancel',
    },
  },
  exporting: {
    started: 'Preparing the export',
    empty: 'Nothing to export',
    failed: 'Export failed',
    filename: 'products.csv',
  },
  importing: {
    title: 'Import products',
    intro:
      'Upload a Shopify products CSV. Handles that already exist are updated, the rest are created.',
    choose: 'Choose a CSV file',
    chosen: (name: string) => `${name} selected`,
    checking: 'Reading the file',
    preview: 'What will happen',
    created: 'New products',
    updated: 'Updated products',
    variants: 'Variants',
    images: 'Image links',
    issues: 'Rows skipped',
    ignored: (columns: string[]) => `Columns ignored: ${columns.join(', ')}`,
    sample: 'First few products',
    exists: 'Update',
    isNew: 'New',
    start: 'Import',
    cancel: 'Cancel',
    running: 'Importing',
    done: (created: number, updated: number) => `${created} created, ${updated} updated`,
    failedRows: (n: number) => `${n} product${n === 1 ? '' : 's'} could not be written`,
    failed: 'Import failed',
  },
  empty: {
    heading: 'No products yet',
    body: 'Add your first product to start selling.',
  },
} as const

/** Rupees ↔ paise helpers for form fields. */
export const rupees = {
  toField: (paise: number | null | undefined) => (paise == null ? '' : (paise / 100).toString()),
  toPaise: parseRupees,
}

/** Sub-sections under Products that have no records yet. */
export const productsSectionsContent = {
  collections: {
    heading: 'No collections',
    body: 'Group products by category, occasion or campaign so shoppers can browse them together on the storefront.',
    action: { label: 'View products', href: routes.products.list() },
  },
  giftCards: {
    heading: 'No gift cards',
    body: 'Gift cards are prepaid balances shoppers redeem at checkout. Issue them manually or sell them as a product.',
    action: { label: 'View products', href: routes.products.list() },
  },
} as const

/** Frames "Product · Banner": the one next step shown above a product's sections. */
export const productBannerContent = {
  summary: (state: string, type: string | null, vendor: string | null) =>
    [state, type, vendor].filter(Boolean).join(' · '),
  state: {
    active: 'Live on your shop',
    draft: 'Draft, not visible to shoppers',
    archived: 'Archived, hidden from your shop',
  },
  low: {
    heading: (what: string) => `${what} is running low`,
    body: (left: number, total: number) =>
      `Only ${left} left of ${total} in total. Reorder before it sells out.`,
    action: 'Update inventory',
  },
  out: {
    heading: 'This product is out of stock',
    body: 'Shoppers cannot buy it until you add stock.',
    action: 'Update inventory',
  },
  draft: {
    heading: 'This product is a draft',
    body: 'Publish it when it is ready for shoppers.',
    action: 'Publish product',
  },
  archived: {
    heading: 'This product is archived',
    body: 'It is hidden from your shop. Set it to active to sell it again.',
    action: 'Set to active',
  },
} as const
