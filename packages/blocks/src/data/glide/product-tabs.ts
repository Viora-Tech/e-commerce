/** Copy and defaults for Product tabs (sections/product-tabs.liquid + blocks/_tab.liquid). */
export const productTabsContent = {
  label: 'Product tabs',
  /** The tab row's accessible name (`products.tabs.label`). */
  ariaLabel: 'Product details',
  /** A tab with no label (`products.tabs.untitled`). */
  untitled: 'Details',
  noProduct: 'Product tabs show on a product page. Preview a product to see them.',
  empty: 'Add a tab with some content. Tabs with nothing in them stay hidden.',
  fields: {
    layout: 'Layout',
    tabs: 'Tabs',
    label: 'Tab label',
    content: 'Shows',
    body: 'Text',
    rows: 'Spec rows (one "Label: value" per line, or connect a metafield)',
    anchor: 'Link anchor (e.g. reviews opens this tab from /products/x#reviews)',
    preselected: 'Open this tab first',
  },
  layouts: [
    { label: 'Tabs', value: 'tabs' },
    { label: 'Stacked, one after another', value: 'stacked' },
  ],
  contents: [
    { label: 'Product description', value: 'description' },
    { label: 'Text', value: 'text' },
    { label: 'Spec rows', value: 'specs' },
  ],
  yesNo: [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ],
  /** The theme's product.json: Description, then a merchant-typed tab. */
  tabs: [
    {
      label: 'Description',
      content: 'description',
      body: '',
      rows: '',
      anchor: '',
      preselected: false,
    },
    {
      label: 'Warranty & claims',
      content: 'text',
      body: '<p><strong>An unboxing video is mandatory.</strong> Record a clear, uncut video while opening the parcel, starting with the sealed package and the label visible. It is the proof for any claim.</p>',
      rows: '',
      anchor: '',
      preselected: false,
    },
  ],
  newTab: { label: 'Tab', content: 'text', body: '', rows: '', anchor: '', preselected: false },
} as const
