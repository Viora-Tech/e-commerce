/** Copy for the bulk editor (`/products/bulk-edit`): a spreadsheet of products and variants. */
export const bulkEditContent = {
  title: 'Bulk edit',
  back: 'Products',
  summary: (products: number, variants: number) =>
    `${products} ${products === 1 ? 'product' : 'products'} · ${variants} ${variants === 1 ? 'variant' : 'variants'}`,
  hint: 'Click a cell and type. Collections are comma-separated names; Yes/No cells open a list. Paste from a spreadsheet, drag the corner to fill down, or press Ctrl+D to copy the cell above.',
  truncated: (max: number) =>
    `Only the first ${max} variants are shown. Select fewer products to edit the rest.`,
  save: 'Save',
  saving: 'Saving',
  discard: 'Discard',
  removeVariants: {
    action: (n: number) => (n === 1 ? 'Delete 1 variant' : `Delete ${n} variants`),
    saveFirst: 'Save or discard your edits before deleting variants',
    title: (n: number) => (n === 1 ? 'Delete this variant?' : `Delete ${n} variants?`),
    body: 'Shoppers can no longer buy them. A variant that is on an order keeps its history and is archived instead.',
    confirm: 'Delete',
    done: (n: number) => (n === 1 ? 'Variant deleted' : `${n} variants deleted`),
    keepOne: (titles: string) => `A product needs at least one variant. Keep one of: ${titles}`,
    failed: 'Could not delete the variants',
  },
  unsaved: (n: number) => `${n} ${n === 1 ? 'cell' : 'cells'} changed`,
  noChanges: 'Nothing changed yet',
  columns: {
    title: 'Title',
    status: 'Status',
    vendor: 'Vendor',
    productType: 'Type',
    tags: 'Tags',
    variantTitle: 'Variant',
    price: 'Price',
    mrp: 'Compare-at',
    cost: 'Cost',
    sku: 'SKU',
    barcode: 'Barcode',
    weight: 'Weight (g)',
    hsCode: 'HSN',
    gst: 'GST %',
    handle: 'URL handle',
    description: 'Description (read-only)',
    collections: 'Collections',
    seoTitle: 'SEO title',
    seoDescription: 'SEO description',
    featured: 'Featured',
    taxIncluded: 'Price includes tax',
    templateSuffix: 'Template',
    trackInventory: 'Track stock',
    countryOfOrigin: 'Origin',
    packageLength: 'Length (cm)',
    packageWidth: 'Width (cm)',
    packageHeight: 'Height (cm)',
    stock: (location: string) => `Stock · ${location}`,
  },
  statuses: { draft: 'Draft', active: 'Active', archived: 'Archived' },
  yesNo: { yes: 'Yes', no: 'No' },
  columnsMenu: {
    label: 'Columns',
    groups: { product: 'Product', variant: 'Variant' },
    stock: 'Stock by location',
  },
  errors: {
    heading: (n: number) =>
      `${n} ${n === 1 ? 'cell needs' : 'cells need'} fixing before you can save`,
    saveFailed: 'Could not save the changes',
    rowLabel: (product: string, variant: string, column: string, message: string) =>
      `${product}${variant ? ` · ${variant}` : ''} · ${column}: ${message}`,
    more: (n: number) => `and ${n} more`,
  },
  toasts: {
    saved: (products: number, variants: number, stock: number) => {
      const parts = [
        products > 0 ? `${products} ${products === 1 ? 'product' : 'products'}` : null,
        variants > 0 ? `${variants} ${variants === 1 ? 'variant' : 'variants'}` : null,
        stock > 0 ? `${stock} stock ${stock === 1 ? 'count' : 'counts'}` : null,
      ].filter(Boolean)
      return `Saved: ${parts.join(', ')}`
    },
    undo: 'Undo',
    undone: 'Changes undone',
    undoFailed: 'Could not undo; the sheet changed since',
  },
  empty: {
    heading: 'Nothing to edit',
    body: 'Select products on the Products page, then choose Bulk edit.',
    action: 'Back to products',
  },
} as const
