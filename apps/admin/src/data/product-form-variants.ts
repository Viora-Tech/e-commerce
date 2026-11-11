/** Copy for the product form's Variants card; part of productFormContent. */

export const productVariantsContent = {
  heading: 'Variants',
  addOption: 'Add options like size or colour',
  addAnother: 'Add another option',
  optionNameSuggestions: [
    'Size',
    'Colour',
    'Material',
    'Style',
    'Length',
    'Weight',
    'Capacity',
    'Storage',
    'Pack size',
  ],
  optionName: 'Option name',
  optionNamePlaceholder: 'Size',
  optionValues: 'Option values',
  optionValuesPlaceholder: 'Type a value and press Enter',
  optionValuesHelp: 'Press Enter or comma after each value.',
  optionValueRemove: (value: string) => `Remove ${value}`,
  optionValueSuggestions: {
    size: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    colour: ['Black', 'White', 'Grey', 'Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Beige'],
    material: ['Cotton', 'Polyester', 'Linen', 'Wool', 'Silk', 'Leather'],
    style: ['Regular fit', 'Slim fit', 'Oversized', 'Classic', 'Casual', 'Formal'],
    length: ['Short', 'Regular', 'Long', '1 m', '2 m', '3 m'],
    weight: ['100 g', '250 g', '500 g', '1 kg', '2 kg', '5 kg'],
    capacity: ['250 ml', '500 ml', '750 ml', '1 L', '2 L', '5 L'],
    storage: ['64GB', '128GB', '256GB', '512GB', '1TB'],
    packSize: ['Pack of 1', 'Pack of 2', 'Pack of 3', 'Pack of 6', 'Pack of 12'],
  },
  remove: 'Remove option',
  done: 'Done',
  /** A folded option chip (#54): click to edit it. */
  editOption: (name: string) => `Edit option ${name}`,
  moreValues: (n: number) => `+${n} more`,
  noMatches: 'No variants match the search.',
  maxOptions: 'Up to 3 options',
  count: (n: number) => `${n} variant${n === 1 ? '' : 's'}`,
  columns: { variant: 'Variant', price: 'Price', mrp: 'MRP', sku: 'SKU', available: 'Available' },
  /** Price cell of a variant listed without a price (#913). */
  noPrice: 'No price yet',
  /** Chip on a variant hidden on the storefront (#934). */
  hidden: 'Hidden',
  /** Chip on a variant whose "Allow pre-order" is off: crossed out on the store once sold out. */
  noPreorder: 'No pre-order',
  /** A visible variant priced ₹0 (#934): allowed (free items), but staff should know. */
  zeroPrice: 'Price is ₹0, shoppers can get this free',
  unlimited: 'Unlimited',
  edit: 'Edit',
  editVariant: (title: string) => `Edit ${title}`,
  /** A variant added since the last save has no page yet. */
  saveFirst: 'Save the product first, then open this variant for its other details.',
  /** Products without options: their one variant's own page (barcode, weight, metafields). */
  variantDetails: 'Variant details',
  footer: {
    stockAcross: (units: number, n: number) =>
      `${units} in stock across ${n} variant${n === 1 ? '' : 's'}`,
    marginOn: (pct: string, profit: string, title: string) =>
      `Margin ${pct}, profit ${profit} on ${title}`,
  },
  tooMany: (n: number) => `${n} variants. Large matrices are slow to edit; consider fewer values.`,
  autoFillSku: 'Suggest SKUs',
  autoFillSkuHelp: 'Fills blank SKUs from the product title and variant.',
  needsValues: 'Add at least one value to each option to build the variants.',
  confirmRemoveTitle: 'Remove variants that have stock?',
  confirmRemoveBody: (n: number, units: number) =>
    `${n} variant${n === 1 ? '' : 's'} holding ${units} unit${units === 1 ? '' : 's'} in stock will be removed. Past orders keep their own record.`,
  confirmRemoveCancel: 'Keep them',
  confirmRemoveConfirm: 'Remove anyway',
}
