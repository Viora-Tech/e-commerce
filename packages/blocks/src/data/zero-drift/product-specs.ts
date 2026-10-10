/** Copy and defaults for Spec groups (sections/product-specs.liquid + snippets/spec-group.liquid). */
export const productSpecsContent = {
  label: 'Spec groups',
  heading: 'Specifications',
  noProduct: 'Spec groups show on a product page. Preview a product to see them.',
  /** `products.spec_groups.empty`, with what to do about it. */
  empty:
    'No spec groups set up yet. Type rows into a group, or connect its rows to a multi-line product metafield.',
  fields: {
    heading: 'Heading',
    openFirst: 'Open the first group',
    groups: 'Groups',
    title: 'Title',
    layout: 'Layout',
    rows: 'Rows: one "Label: value | sub-line" per line (or connect a multi-line metafield)',
    note: 'Note under the group',
  },
  yesNo: [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ],
  layouts: [
    { label: 'Columns (many label and value pairs)', value: 'columns' },
    { label: 'Tiles (a few numbers)', value: 'tiles' },
    { label: 'List (package contents)', value: 'list' },
    { label: 'Benefits', value: 'benefit' },
  ],
  /**
   * The theme reads `custom.spec_groups`; here each group's rows are typed or connected.
   * Rows start empty so no product shows another product's numbers.
   */
  groups: [
    { title: 'Dimensions', layout: 'tiles', rows: '', note: '' },
    { title: 'Specification', layout: 'columns', rows: '', note: '' },
    { title: 'Package contents', layout: 'list', rows: '', note: '' },
  ],
  newGroup: { title: 'Group', layout: 'columns', rows: '', note: '' },
} as const
