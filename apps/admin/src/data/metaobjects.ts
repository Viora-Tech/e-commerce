import type { FieldType } from '@commerce/core/metaobjects'

/** Field types, grouped as Shopify's type picker groups them. */
export const FIELD_TYPE_GROUPS: { label: string; types: FieldType[] }[] = [
  { label: 'Text', types: ['single_line_text', 'multi_line_text', 'rich_text'] },
  { label: 'Number', types: ['number_integer', 'number_decimal'] },
  { label: 'Date, link and choice', types: ['date', 'url', 'boolean'] },
  { label: 'Media', types: ['file'] },
  {
    label: 'Reference',
    types: ['product_reference', 'collection_reference', 'metaobject_reference'],
  },
]

export const fieldTypeContent: Record<FieldType, { label: string; help: string }> = {
  single_line_text: {
    label: 'Single line text',
    help: 'A name, a label or one of a set of choices.',
  },
  multi_line_text: {
    label: 'Multi-line text',
    help: 'Plain text with line breaks, like care instructions.',
  },
  rich_text: { label: 'Rich text', help: 'Formatted text with headings, lists and links.' },
  number_integer: { label: 'Integer', help: 'A whole number, like a warranty in months.' },
  number_decimal: { label: 'Decimal', help: 'A number with decimals, like a weight in kg.' },
  boolean: { label: 'True or false', help: 'A yes or no answer.' },
  date: { label: 'Date', help: 'A calendar day.' },
  url: { label: 'URL', help: 'A web address starting with https://.' },
  file: { label: 'File', help: 'An image or document from your files.' },
  product_reference: { label: 'Product', help: 'A product from your catalogue.' },
  collection_reference: { label: 'Collection', help: 'One of your collections.' },
  metaobject_reference: { label: 'Metaobject', help: 'An entry of another metaobject.' },
}

export const metaobjectListContent = {
  heading: 'Metaobjects',
  subtitle:
    'Structured content, like size guides, designers or FAQs, that templates and products can use.',
  add: 'Add definition',
  resource: { singular: 'definition', plural: 'definitions' },
  columns: {
    name: 'Name',
    type: 'Type',
    fields: 'Fields',
    entries: 'Entries',
    updated: 'Last updated',
  },
  fieldCount: (n: number) => (n === 1 ? '1 field' : `${n} fields`),
  hidden: 'Hidden from storefront',
  empty: {
    heading: 'Create structured content',
    body: 'Define a metaobject, such as a size guide or an ingredient, give it fields, then add entries you can attach to products and show on your storefront.',
  },
  customData: 'Product and collection metafields',
} as const

export const definitionFormContent = {
  newTitle: 'Add metaobject definition',
  viewEntries: 'View entries',
  back: 'Metaobjects',
  save: 'Save',
  saving: 'Saving',
  saved: 'Definition saved',
  created: 'Definition created',
  failed: 'Could not save the definition',
  unsaved: 'Unsaved definition',
  discard: 'Discard',
  nameRequired: 'Give the definition a name',
  details: {
    name: 'Name',
    namePlaceholder: 'Size guide',
    type: 'Type',
    typeHelp: 'Templates read entries by this handle. It cannot change once entries exist.',
    description: 'Description',
    descriptionHelp: 'Shown to staff only.',
  },
  fields: {
    heading: 'Fields',
    body: 'Every entry of this metaobject has these fields.',
    add: 'Add field',
    empty: 'No fields yet. Add the first one, such as a title.',
    required: 'Required',
    list: 'List',
    edit: 'Edit field',
    remove: 'Remove field',
    moveUp: 'Move up',
    moveDown: 'Move down',
  },
  display: {
    heading: 'Display name',
    body: 'The field that names each entry in lists and pickers.',
    none: 'Use the handle',
  },
  access: {
    heading: 'Access',
    storefront: 'Storefront access',
    storefrontHelp: 'Let storefront templates read these entries. Turn off for internal data.',
  },
  delete: {
    action: 'Delete definition',
    title: (name: string) => `Delete ${name}?`,
    body: (entries: number) =>
      entries === 0
        ? 'This definition has no entries. This cannot be undone.'
        : `Its ${entries === 1 ? 'entry' : `${entries} entries`} will be deleted too. This cannot be undone.`,
    confirm: 'Delete',
    cancel: 'Cancel',
    done: 'Definition deleted',
  },
} as const

export const fieldDialogContent = {
  addTitle: 'Add field',
  editTitle: 'Edit field',
  name: 'Name',
  namePlaceholder: 'Title',
  key: 'Key',
  keyHelp: 'Used by templates. Lower case letters, digits and underscores.',
  type: 'Type',
  typePlaceholder: 'Select a type',
  description: 'Description',
  list: 'Accept a list of values',
  listHelp: 'Store several values in order, like a list of products.',
  required: 'Required',
  requiredHelp: 'Entries cannot be saved without it.',
  rules: 'Validation',
  min: 'Minimum',
  max: 'Maximum',
  minDate: 'Earliest date',
  maxDate: 'Latest date',
  minLength: 'Minimum characters',
  maxLength: 'Maximum characters',
  maxItems: 'Maximum items',
  choices: 'Preset choices',
  choicesHelp: 'One per line. Leave empty to allow any text.',
  target: 'Metaobject',
  targetPlaceholder: 'Select a metaobject',
  noTargets: 'Create another metaobject definition first.',
  cancel: 'Cancel',
  done: 'Done',
  keyTaken: 'Another field already uses this key',
  nameRequired: 'Give the field a name',
  typeRequired: 'Pick a type',
} as const

export const entryListContent = {
  add: 'Add entry',
  editDefinition: 'Edit definition',
  back: 'Metaobjects',
  resource: { singular: 'entry', plural: 'entries' },
  columns: { name: 'Name', handle: 'Handle', status: 'Status', updated: 'Last updated' },
  status: { active: 'Active', draft: 'Draft' },
  empty: {
    heading: (name: string) => `Add your first ${name.toLowerCase()} entry`,
    body: 'Entries hold the content. Each one gets its own handle that templates can read.',
  },
  noFields: {
    heading: 'This definition has no fields yet',
    body: 'Add fields to the definition before creating entries.',
  },
  bulk: {
    delete: 'Delete entries',
    deleted: (n: number) => (n === 1 ? 'Entry deleted' : `${n} entries deleted`),
    failed: 'Could not delete the entries',
    confirmTitle: (n: number) => (n === 1 ? 'Delete this entry?' : `Delete ${n} entries?`),
    confirmBody: 'Products and other entries that reference them will lose the reference.',
    confirm: 'Delete',
    cancel: 'Cancel',
  },
} as const

export const entryFormContent = {
  newTitle: (name: string) => `Add ${name.toLowerCase()}`,
  save: 'Save',
  saving: 'Saving',
  saved: 'Entry saved',
  created: 'Entry created',
  failed: 'Could not save the entry',
  fixErrors: 'Fix the highlighted fields and save again',
  unsaved: 'Unsaved entry',
  discard: 'Discard',
  delete: 'Delete entry',
  deleted: 'Entry deleted',
  status: {
    heading: 'Status',
    active: 'Active',
    draft: 'Draft',
    help: 'Draft entries are hidden from the storefront.',
  },
  handle: {
    heading: 'Handle',
    help: 'Templates find this entry by its handle. Leave empty to generate one.',
  },
  required: 'Required',
} as const

export const fieldInputContent = {
  yes: 'True',
  no: 'False',
  addItem: 'Add item',
  removeItem: 'Remove',
  pick: {
    product: 'Select product',
    collection: 'Select collection',
    metaobject: 'Select entry',
    file: 'Select file',
  },
  change: 'Change',
  remove: 'Remove',
  search: 'Search',
  noResults: 'Nothing matches that search',
  loading: 'Loading',
  filesEmpty: 'Upload files under Content, Files first.',
  missing: 'No longer available',
  choose: 'Choose a value',
} as const

export const customDataContent = {
  title: 'Custom data',
  intro: 'Add your own fields to products and collections, and manage metaobject definitions.',
  tabs: {
    products: { id: 'products', label: 'Products' },
    collections: { id: 'collections', label: 'Collections' },
    metaobjects: { id: 'metaobjects', label: 'Metaobjects' },
  },
  metafields: {
    heading: (owner: string) => `${owner} metafields`,
    body: (owner: string) =>
      `Fields every ${owner.toLowerCase()} can fill in, shown in a Metafields card on its page.`,
    add: 'Add definition',
    empty: (owner: string) =>
      `No ${owner.toLowerCase()} metafields yet. Add one, like a care guide or a warranty period.`,
    values: (n: number) => (n === 1 ? '1 value' : `${n} values`),
    listOf: (label: string) => `List of ${label.toLowerCase()}`,
    hidden: 'Hidden from storefront',
    edit: 'Edit',
    delete: 'Delete',
  },
  dialog: {
    addTitle: (owner: string) => `Add ${owner.toLowerCase()} metafield`,
    editTitle: 'Edit metafield',
    name: 'Name',
    namePlaceholder: 'Care guide',
    namespaceKey: 'Namespace and key',
    namespaceKeyHelp: 'Templates read it as metafields.namespace.key. Fixed once created.',
    description: 'Description',
    storefront: 'Storefront access',
    storefrontHelp: 'Let storefront templates read this value.',
    fixed: 'The type and key cannot change after the metafield is created.',
    save: 'Save',
    saving: 'Saving',
    cancel: 'Cancel',
    saved: 'Metafield definition saved',
    failed: 'Could not save the metafield definition',
  },
  remove: {
    title: (name: string) => `Delete ${name}?`,
    body: (n: number) =>
      n === 0
        ? 'No values are stored yet.'
        : `The ${n === 1 ? 'value stored on 1 item' : `values stored on ${n} items`} will be deleted too.`,
    confirm: 'Delete',
    cancel: 'Cancel',
    done: 'Metafield definition deleted',
  },
  metaobjects: {
    heading: 'Metaobject definitions',
    body: 'Structured content types. Manage their entries under Content, Metaobjects.',
    add: 'Add definition',
    empty: 'No metaobject definitions yet.',
    entries: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  },
  owners: { product: 'Product', collection: 'Collection' },
  loadFailed: 'Could not load custom data',
} as const

export const metafieldsCardContent = {
  heading: 'Metafields',
  empty: 'Add custom fields, like a care guide or warranty, to show extra details.',
  manage: 'Manage definitions',
  saveFirst: 'Save first to fill in metafields.',
  save: 'Save metafields',
  saving: 'Saving',
  saved: 'Metafields saved',
  failed: 'Could not save the metafields',
} as const
