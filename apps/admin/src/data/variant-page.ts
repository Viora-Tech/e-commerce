/** Every string the variant page shows (Products › a product › a variant). */
export const variantPageContent = {
  /** Browser tab and the title when a variant has no option values. */
  pageTitle: 'Variant',
  /** The back link above the title: the product's own name. */
  back: (product: string) => product,
  /** Header line: "Variant 2 of 4 · ₹21,999 · 12 in stock". */
  position: (n: string, of: string) => `Variant ${n} of ${of}`,
  inStock: (n: string) => `${n} in stock`,
  unlimited: 'Not tracked',
  noPrice: 'No price yet',
  moreActions: 'More actions',
  /** The left column: every variant of the product. */
  list: {
    heading: 'Variants',
    /** Phone width: the list folds into a picker above the cards. */
    pick: 'Variant',
    stock: (n: string) => `${n} in stock`,
    notTracked: 'Not tracked',
  },
  options: {
    heading: 'Options',
    /** A product without options has one variant and nothing to pick. */
    none: 'This product has no options, so it has one variant.',
    help: 'Pick which values this variant is. Add or rename values on the product, under Variants.',
    /** Two variants can't share the same values. */
    taken: (title: string) => `Another variant is already ${title}. Pick different values.`,
  },
  image: {
    heading: 'Image',
    help: 'The photos shoppers see when they pick this variant. The first one is its main image.',
  },
  pricing: { heading: 'Pricing' },
  inventory: {
    heading: 'Inventory',
    /** Stock is kept at the default location here; the bulk editor shows every location. */
    byLocation: 'Stock at each location',
  },
  shipping: { heading: 'Shipping' },
  metafields: {
    heading: 'Metafields',
    help: "This variant's own values. They save with the variant.",
    failed: 'The variant saved, but its metafields did not. Check the fields and save again.',
  },
  delete: {
    action: 'Delete variant',
    title: (name: string) => `Delete ${name}?`,
    body: 'It leaves the store straight away. Past orders keep this item, and you can add the variant again later from the product.',
    confirm: 'Delete variant',
    cancel: 'Cancel',
    /** A product keeps at least one variant. */
    onlyOne: 'A product needs at least one variant.',
    done: 'Variant deleted',
  },
  saved: 'Variant saved',
  /** The fields of one variant, grouped as Shopify's variant page does. */
  fields: {
    /** Variant page, when HSN and GST are set once for the product (#63). */
    taxFromProduct: 'HSN code and GST rate are set for the whole product on its Shipping tab.',
    /** Placeholder of a per-variant field left blank: the product's value applies. */
    fromProduct: (value: string) => `Product: ${value}`,
    track: 'Track quantity',
    trackHelp: 'Off sells it without counting stock.',
    hide: 'Hide on store',
    hideHelp:
      "Shoppers can't see, pick or buy it. It stays here, in orders and in reports. Use it instead of deleting.",
    preorder: 'Allow pre-order',
    preorderHelp:
      'When the product is on pre-order, this variant keeps selling after it runs out. Off: once sold out it shows crossed out and cannot be bought.',
    /** The variant's own pre-order limit, shown while the product takes pre-orders. */
    preorderLimit: 'Pre-order limit',
    preorderLimitHelp:
      "Most pre-orders this variant takes once it is out of stock. Leave blank to use the product's limit.",
    /** Placeholder while blank: the limit the variant uses instead. */
    preorderLimitFromProduct: (limit: string) => `Uses product: ${limit}`,
    preorderLimitNone: 'No limit',
    preorderLimitFromCampaign: "Uses the campaign's limit",
  },
}
