/** Copy and defaults for the Size table (sections/product-size-table.liquid + assets/size-units.js, values from templates/product.json). */
export const productSizeTableContent = {
  label: 'Size table',
  noProduct: 'The size table shows on a product page. Preview a product to see it.',
  /** `products.size_table.empty`, with what to do about it. */
  empty:
    'No size table set up yet. Type the header row and one row per size, cells split by |, or connect the table to a multi-line product metafield.',
  heading: 'Measurements',
  /** The scroll region's name when the heading is blank (`products.size_table.region_label`). */
  regionLabel: 'Measurements',
  note: 'Measurements are of the garment laid flat, as published by the manufacturer, not of the wearer.',
  units: 'Units',
  fields: {
    heading: 'Heading',
    table:
      'Table: header row first, then one row per size, cells split by | (or connect a multi-line metafield)',
    showUnits: 'Show mm / cm / in switcher',
    note: 'Note under the table',
  },
  yesNo: [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ],
  /** Empty, so no product shows another product's measurements. */
  table: '',
  unitOptions: ['mm', 'cm', 'in'] as const,
  /** Where the shopper's unit choice is remembered (the theme kept it per browser too). */
  storageKey: 'zero-drift:size-units',
} as const
