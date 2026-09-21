import type { ProductStatus } from '@commerce/core/catalog'

export const PRODUCT_STATUSES = ['active', 'draft', 'archived'] as const

export const PRODUCT_STATUS_TONE: Record<ProductStatus, 'success' | 'info' | 'neutral'> = {
  active: 'success',
  draft: 'info',
  archived: 'neutral',
}

/** Every string the products list shows. */
export const productsListContent = {
  title: 'Products',
  resource: { singular: 'product', plural: 'products' },
  add: 'Add product',
  export: 'Export',
  import: 'Import',
  tabs: { all: 'All' },
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
  inventory: (available: number, variants: number) =>
    `${available} in stock for ${variants} variant${variants === 1 ? '' : 's'}`,
  none: '',
  bulk: {
    setActive: 'Set as active',
    archive: 'Archive',
    updated: (n: number) => `${n} product${n === 1 ? '' : 's'} updated`,
    failed: 'Could not update products',
  },
  empty: {
    heading: 'No products yet',
    body: 'Add your first product to start selling.',
  },
} as const

/** Every string the product form shows. Change copy here, never in a component. */
export const productFormContent = {
  newTitle: 'Add product',
  backLabel: 'Products',
  preview: 'Preview',
  saveBar: { message: 'Unsaved changes', save: 'Save', discard: 'Discard' },
  toasts: {
    saved: 'Product saved',
    created: 'Product created',
    deleted: 'Product deleted',
    archived: 'Product archived: it has orders, so it was kept for history',
    failed: 'Save failed',
  },
  errors: {
    title: 'Add a title',
    variantsBanner: 'Fix the variants before saving',
    required: 'Required',
  },
  /** Aria label for the money prefix so screen readers read the currency. */
  currency: 'Rupees',
  details: {
    title: 'Title',
    titlePlaceholder: 'Short sleeve t-shirt',
    description: 'Description',
    descriptionPlaceholder: 'Tell shoppers what makes it worth buying.',
  },
  media: {
    heading: 'Media',
    empty: 'No images yet',
    dropzone: 'Drop images here or click to upload',
    uploadSoon: 'Uploads land with the media library. Images from the import are shown here.',
  },
  pricing: {
    heading: 'Pricing',
    price: 'Price',
    mrp: 'Compare-at price (MRP)',
    cost: 'Cost per item',
    costHelp: 'Shoppers never see this.',
    margin: (pct: string, profit: string) => `Margin ${pct} · Profit ${profit}`,
    taxable: 'Charge tax on this product',
  },
  inventory: {
    heading: 'Inventory',
    sku: 'SKU (Stock Keeping Unit)',
    barcode: 'Barcode (ISBN, UPC, GTIN)',
    track: 'Track quantity',
    quantity: 'Quantity',
    reason: 'Reason for change',
    weight: 'Weight (grams)',
    weightHelp: 'Used for courier rates. Empty means the store default.',
    reasons: [
      { label: 'Correction', value: 'correction' },
      { label: 'Stock received', value: 'received' },
      { label: 'Damaged', value: 'damaged' },
      { label: 'Returned', value: 'returned' },
      { label: 'Sold offline', value: 'sold' },
      { label: 'Other', value: 'other' },
    ],
  },
  variants: {
    heading: 'Variants',
    addOption: 'Add options like size or colour',
    addAnother: 'Add another option',
    optionName: 'Option name',
    optionNamePlaceholder: 'Size',
    optionValues: 'Option values',
    optionValuesPlaceholder: 'Small, Medium, Large',
    optionValuesHelp: 'Separate values with commas.',
    remove: 'Remove option',
    done: 'Done',
    maxOptions: 'Up to 3 options',
    count: (n: number) => `${n} variant${n === 1 ? '' : 's'}`,
    columns: { variant: 'Variant', price: 'Price', mrp: 'MRP', sku: 'SKU', available: 'Available' },
    tooMany: (n: number) =>
      `${n} variants. Large matrices are slow to edit; consider fewer values.`,
  },
  status: {
    heading: 'Status',
    label: 'Status',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Draft', value: 'draft' },
      { label: 'Archived', value: 'archived' },
    ],
    help: {
      active: 'Visible on the storefront.',
      draft: 'Hidden until you publish it.',
      archived: 'Hidden and kept for order history.',
    },
  },
  organisation: {
    heading: 'Product organisation',
    type: 'Product type',
    vendor: 'Vendor',
    tags: 'Tags',
    tagsPlaceholder: 'Add a tag and press Enter',
    removeTag: (tag: string) => `Remove ${tag}`,
  },
  seo: {
    heading: 'Search engine listing',
    edit: 'Edit',
    title: 'Page title',
    titleHelp: (n: number) => `${n} of 70 characters used`,
    description: 'Meta description',
    descriptionHelp: (n: number) => `${n} of 320 characters used`,
    handle: 'URL handle',
    handlePrefix: '/products/',
    previewLabel: 'Preview',
    previewHint:
      'Add a title and description to see how this product might appear in a search engine listing.',
  },
  delete: {
    action: 'Delete product',
    title: (name: string) => `Delete ${name}?`,
    body: 'This cannot be undone. Products with orders are archived instead so history stays intact.',
    confirm: 'Delete',
    cancel: 'Cancel',
  },
} as const

/** Rupees ↔ paise helpers for form fields. */
export const rupees = {
  toField: (paise: number | null | undefined) => (paise == null ? '' : (paise / 100).toString()),
  toPaise: (field: string): number | null => {
    const n = Number(field)
    return field.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100)
  },
}

/** Sub-sections under Products that have no records yet. */
export const productsSectionsContent = {
  collections: {
    heading: 'No collections',
    body: 'Group products by category, occasion or campaign so shoppers can browse them together on the storefront.',
    action: { label: 'View products', href: '/products' },
  },
  inventory: {
    heading: 'Inventory lives on each product',
    body: 'Stock levels and adjustments are tracked per variant. Open a product to change quantities or see its adjustment history.',
    action: { label: 'View products', href: '/products' },
  },
  transfers: {
    heading: 'No transfers',
    body: 'Transfers record stock moving between locations or arriving from a supplier so counts stay accurate.',
    action: { label: 'View products', href: '/products' },
  },
  giftCards: {
    heading: 'No gift cards',
    body: 'Gift cards are prepaid balances shoppers redeem at checkout. Issue them manually or sell them as a product.',
    action: { label: 'View products', href: '/products' },
  },
} as const
