import type { ProductStatus } from '@commerce/core/catalog'

export const PRODUCT_STATUSES = ['active', 'draft', 'archived'] as const

/** Every string the products list shows. */
export const productsListContent = {
  title: 'Products',
  /* Same frame family as the order list (5:2353): heading, primary action, tab group. */
  heading: 'Product list',
  resource: { singular: 'product', plural: 'products' },
  add: 'Add product',
  export: 'Export',
  import: 'Import',
  tabs: { all: 'All products' },
  tiles: {
    total: 'Total products',
    active: 'Active',
    outOfStock: 'Out of stock',
    stockValue: 'Stock at cost',
    period: 'Across the catalogue',
  },
  filters: {
    label: 'Filters',
    vendor: 'Vendor',
    productType: 'Product type',
    tag: 'Tag',
    stock: 'Stock',
    any: 'Any',
    stockOptions: [
      { value: 'in', label: 'In stock' },
      { value: 'low', label: 'Low stock' },
      { value: 'out', label: 'Out of stock' },
    ],
    clear: 'Clear',
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
  inventory: (available: number, variants: number) =>
    `${available} in stock for ${variants} variant${variants === 1 ? '' : 's'}`,
  none: '',
  bulk: {
    setActive: 'Set as active',
    setDraft: 'Set as draft',
    archive: 'Archive',
    addTag: 'Add tag',
    delete: 'Delete',
    tagPrompt: 'Tag to add',
    tagPlaceholder: 'summer',
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

/** Every string the product form shows. Change copy here, never in a component. */
export const productFormContent = {
  newTitle: 'Add new product',
  editTitle: 'Edit product',
  searchPlaceholder: 'Search product for add',
  publish: 'Publish product',
  saveDraft: 'Save to draft',
  addAnother: 'Start another product',
  basics: 'Basic details',
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
    heading: 'Upload product image',
    label: 'Product image',
    browse: 'Browse',
    replace: 'Replace',
    add: 'Add image',
    remove: (name: string) => `Remove ${name}`,
    coverAlt: 'Cover image',
    empty: 'Drop an image here or browse for one.',
  },
  categories: {
    heading: 'Categories',
    type: 'Product categories',
    typePlaceholder: 'Select a category',
    tag: 'Product tag',
    colour: 'Select your colour',
    colourHelp: 'From the colour option on this product.',
  },
  pricing: {
    heading: 'Pricing',
    price: 'Product price',
    currency: 'INR',
    mrp: 'Compare at price',
    mrpOptional: '(optional)',
    /** Trailing figure in the compare-at field, the frame's "Sale=" slot. */
    saving: (amount: string) => `Save ${amount}`,
    mrpBelowPrice: 'Keep it above the product price so the saving reads right.',
    cost: 'Cost per item',
    costHelp: 'Shoppers never see this.',
    margin: (pct: string, profit: string) => `Margin ${pct}, profit ${profit}`,
    taxable: 'Charge tax on this product',
    taxIncluded: 'Tax included',
    taxIncludedYes: 'Yes',
    taxIncludedNo: 'No',
    taxIncludedHelp:
      'Yes means the price already carries GST and the split is extracted on the order.',
    expiration: 'Expiration',
    expirationStart: 'Start',
    expirationEnd: 'End',
    expirationHelp: 'When the compare at price applies. Leave empty to run it always.',
  },
  inventory: {
    heading: 'Inventory',
    stockQuantity: 'Stock quantity',
    stockStatus: 'Stock status',
    unlimited: 'Unlimited',
    unlimitedValue: 'Unlimited',
    unlimitedHelp: 'Stock is never counted down for this product.',
    featured: 'Highlight this product in a featured section.',
    stockStates: {
      unlimited: 'Unlimited',
      inStock: 'In stock',
      low: 'Low stock',
      out: 'Out of stock',
    },
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
  shipping: {
    heading: 'Shipping',
    weight: 'Weight (grams)',
    weightHelp: 'Used for courier rates. Empty means the store default.',
    hsCode: 'HS (harmonised system) code',
    hsCodeHelp: 'Used on customs forms for international orders.',
    country: 'Country of origin',
    countryHelp: 'Where the product was made or assembled.',
    countryPlaceholder: 'Select a country',
  },
  history: {
    heading: 'Stock history',
    empty: 'No stock movements yet. Changes you make to quantities show up here.',
    columns: { when: 'When', variant: 'Variant', change: 'Change', reason: 'Reason' },
    failed: 'Could not load stock history',
  },
  duplicate: {
    action: 'Duplicate',
    toast: 'Product duplicated',
    failed: 'Could not duplicate',
  },
  unsaved: 'Leave without saving? Your changes will be lost.',
  variantBulk: {
    selected: (n: number) => `${n} variant${n === 1 ? '' : 's'} selected`,
    price: 'Set price',
    quantity: 'Set quantity',
    apply: 'Apply',
    clear: 'Clear selection',
    image: 'Image',
    chooseImage: 'Choose image',
    noImage: 'No image',
    selectAll: 'Select all variants',
    selectOne: (title: string) => `Select ${title}`,
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
  giftCards: {
    heading: 'No gift cards',
    body: 'Gift cards are prepaid balances shoppers redeem at checkout. Issue them manually or sell them as a product.',
    action: { label: 'View products', href: '/products' },
  },
} as const
