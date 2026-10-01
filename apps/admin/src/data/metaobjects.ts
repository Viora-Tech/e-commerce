import type { FieldType, PresetKey } from '@commerce/core/metaobjects'

/*
 * Merchants see "Content types", "Entries" and "Extra fields"; the code, the API and the
 * developer docs keep Shopify's names (metaobject, metafield). Hindi: data/hi/metaobjects.ts.
 */

/** Field type picker groups, in order. Labels live in `fieldTypeContent.groups`. */
export const FIELD_TYPE_GROUPS = [
  { id: 'text', types: ['single_line_text', 'multi_line_text', 'rich_text'] },
  { id: 'number', types: ['number_integer', 'number_decimal'] },
  { id: 'choice', types: ['date', 'url', 'boolean'] },
  { id: 'media', types: ['file'] },
  { id: 'link', types: ['product_reference', 'collection_reference', 'metaobject_reference'] },
] as const satisfies readonly { id: string; types: readonly FieldType[] }[]
type FieldTypeGroup = (typeof FIELD_TYPE_GROUPS)[number]['id']

export const fieldTypeContent: {
  groups: Record<FieldTypeGroup, string>
  types: Record<FieldType, { label: string; help: string }>
} = {
  groups: {
    text: 'Text',
    number: 'Numbers',
    choice: 'Date, link and yes / no',
    media: 'Pictures and files',
    link: 'Pick from your store',
  },
  types: {
    single_line_text: { label: 'Short text', help: 'A name, a label or one of a few choices.' },
    multi_line_text: {
      label: 'Long text',
      help: 'Plain text over several lines, like care instructions.',
    },
    rich_text: { label: 'Formatted text', help: 'Text with headings, bold, lists and links.' },
    number_integer: { label: 'Whole number', help: 'Like a warranty in months: 12.' },
    number_decimal: { label: 'Decimal number', help: 'Like a weight in kg: 1.5.' },
    boolean: { label: 'Yes / No', help: 'A tick box: yes or no.' },
    date: { label: 'Date', help: 'A day on the calendar.' },
    url: { label: 'Link', help: 'A web address starting with https://.' },
    file: { label: 'File', help: 'A picture or document from your files.' },
    product_reference: { label: 'Product', help: 'One of your products.' },
    collection_reference: { label: 'Collection', help: 'One of your collections.' },
    metaobject_reference: {
      label: 'Another entry',
      help: 'An entry of another content type, like a designer.',
    },
  },
}

/** The "What do you want to make?" picture cards: one per preset, plus a blank start. */
export const presetContent: Record<PresetKey | 'blank', { title: string; body: string }> = {
  size_guide: { title: 'Size guide', body: 'Size charts for your product pages.' },
  faq: { title: 'FAQ', body: 'Questions customers ask, with your answers.' },
  team_member: { title: 'Team member', body: 'The people behind your shop.' },
  store_location: { title: 'Store location', body: 'Shops and pickup points to visit.' },
  testimonial: { title: 'Testimonial', body: 'Kind words from happy customers.' },
  lookbook: { title: 'Lookbook', body: 'Styled photos with the products in them.' },
  blank: { title: 'Start from blank', body: 'Pick every field yourself.' },
}

export const newContentTypeContent = {
  title: 'New content type',
  back: 'Content types',
  pick: {
    heading: 'What do you want to make?',
    body: 'Pick one to start with ready-made fields. You can change them later.',
  },
  name: {
    heading: 'What should we call it?',
    body: 'Only you and your staff see this name.',
    label: 'Name',
    fields: 'Fields it comes with',
    create: 'Create',
    creating: 'Creating',
    change: 'Pick something else',
  },
  created: (name: string) => `${name} is ready. Add your first entry.`,
  failed: 'Could not create it. Check your connection and try again.',
} as const

export const metaobjectListContent = {
  heading: 'Content types',
  subtitle:
    'Your own kinds of content, like size guides, FAQs or store locations, to show on your store.',
  add: 'Add content type',
  resource: { singular: 'content type', plural: 'content types' },
  columns: {
    name: 'Name',
    type: 'Handle',
    fields: 'Fields',
    entries: 'Entries',
    updated: 'Last updated',
  },
  fieldCount: (n: number) => (n === 1 ? '1 field' : `${n} fields`),
  hidden: 'Hidden from storefront',
  empty: {
    heading: 'Make your own kind of content',
    body: 'Start with a size guide, an FAQ or a store location. Add entries, then show them on your product pages and store.',
  },
  customData: 'Extra fields',
} as const

export const definitionFormContent = {
  newTitle: 'Start from blank',
  viewEntries: 'View entries',
  back: 'Content types',
  save: 'Save',
  saving: 'Saving',
  saved: 'Content type saved',
  created: 'Content type created',
  failed: 'Could not save. Check your connection and try again.',
  unsaved: 'Unsaved changes',
  discard: 'Discard',
  nameRequired: 'Type a name first, like Size guide',
  details: {
    name: 'Name',
    namePlaceholder: 'Size guide',
    type: 'Handle',
    typeHelp: 'Your theme finds entries by this handle. It is fixed once the first entry is added.',
    description: 'Description',
    descriptionHelp: 'A note for you and your staff. Customers never see it.',
  },
  fields: {
    heading: 'Fields',
    body: 'Every entry has these fields to fill in.',
    add: 'Add field',
    empty: 'No fields yet. Add the first one, like a title.',
    required: 'Must fill',
    list: 'Several values',
    edit: 'Edit field',
    remove: 'Remove field',
    moveUp: 'Move up',
    moveDown: 'Move down',
  },
  display: {
    heading: 'Entry name',
    body: 'The field that names each entry in lists and pickers.',
    none: 'Use the handle',
  },
  access: {
    heading: 'Who can see it',
    storefront: 'Show on your store',
    storefrontHelp: 'Let your theme show these entries. Turn off for notes only staff should see.',
  },
  delete: {
    action: 'Delete content type',
    title: (name: string) => `Delete ${name}?`,
    body: (entries: number) =>
      entries === 0
        ? 'It has no entries yet. You cannot undo this.'
        : `Its ${entries === 1 ? 'entry' : `${entries} entries`} will be deleted too. You cannot undo this.`,
    confirm: 'Delete',
    cancel: 'Cancel',
    done: 'Content type deleted',
  },
} as const

export const fieldDialogContent = {
  addTitle: 'Add field',
  editTitle: 'Edit field',
  name: 'Name',
  namePlaceholder: 'Title',
  key: 'Key',
  keyHelp: 'Your theme reads it by this key. Use small letters, numbers and _ only.',
  type: 'What goes in it',
  typePlaceholder: 'Pick a kind of value',
  description: 'Hint',
  list: 'Allow several values',
  listHelp: 'Keep a list in order, like several products or size rows.',
  required: 'Must fill',
  requiredHelp: 'An entry cannot be saved while this is empty.',
  rules: 'Limits',
  min: 'Smallest',
  max: 'Largest',
  minDate: 'Earliest date',
  maxDate: 'Latest date',
  minLength: 'Fewest characters',
  maxLength: 'Most characters',
  maxItems: 'Most values',
  choices: 'Preset choices',
  choicesHelp: 'One per line. Leave empty to allow any text.',
  target: 'Content type',
  targetPlaceholder: 'Pick a content type',
  noTargets: 'Make another content type first, then link to it here.',
  cancel: 'Cancel',
  done: 'Done',
  keyTaken: 'Another field already uses this key. Change one of them.',
  nameRequired: 'Type a name for the field',
  typeRequired: 'Pick what goes in the field',
} as const

export const entryListContent = {
  add: 'Add entry',
  editDefinition: 'Edit fields',
  back: 'Content types',
  resource: { singular: 'entry', plural: 'entries' },
  columns: { name: 'Name', handle: 'Handle', status: 'Status', updated: 'Last updated' },
  status: { active: 'Active', draft: 'Draft' },
  empty: {
    heading: (name: string) => `Add your first ${name.toLowerCase()}`,
    body: 'Each entry is one item, like one size chart or one question. Your theme can show it on your store.',
  },
  noFields: {
    heading: 'Add some fields first',
    body: 'Fields are what you fill in for each entry, like a title or a picture.',
  },
  bulk: {
    delete: 'Delete entries',
    deleted: (n: number) => (n === 1 ? 'Entry deleted' : `${n} entries deleted`),
    failed: 'Could not delete. Check your connection and try again.',
    confirmTitle: (n: number) => (n === 1 ? 'Delete this entry?' : `Delete ${n} entries?`),
    confirmBody: 'Products and entries that link to them will lose the link. You cannot undo this.',
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
  failed: 'Could not save. Check your connection and try again.',
  fixErrors: 'Fix the fields marked in red, then save again',
  unsaved: 'Unsaved changes',
  discard: 'Discard',
  delete: 'Delete entry',
  deleted: 'Entry deleted',
  duplicate: 'Duplicate',
  duplicated: 'Copy made as a draft',
  status: {
    heading: 'Status',
    active: 'Active',
    draft: 'Draft',
    help: 'Draft entries stay hidden from your store.',
  },
  handle: {
    heading: 'Handle',
    help: 'Your theme finds this entry by its handle. Leave empty and we make one.',
  },
  required: 'Must fill',
} as const

export const fieldInputContent = {
  yes: 'Yes',
  no: 'No',
  addItem: 'Add another',
  removeItem: 'Remove',
  pick: {
    product: 'Pick product',
    collection: 'Pick collection',
    metaobject: 'Pick entry',
    file: 'Pick file',
  },
  change: 'Change',
  remove: 'Remove',
  search: 'Search',
  noResults: 'Nothing matches. Try another word.',
  loading: 'Loading',
  filesEmpty: 'No files yet. Upload them under Content, Files first.',
  missing: 'Deleted. Pick another one.',
  choose: 'Pick one',
} as const

export const customDataContent = {
  title: 'Custom data',
  intro: 'Add extra fields to your products and collections, and manage your content types.',
  tabs: {
    products: { id: 'products', label: 'Products' },
    collections: { id: 'collections', label: 'Collections' },
    metaobjects: { id: 'metaobjects', label: 'Content types' },
  },
  metafields: {
    heading: (owner: string) => `${owner} extra fields`,
    body: (owner: string) =>
      `Fields every ${owner.toLowerCase()} can fill in, shown in an Extra fields card on its page.`,
    add: 'Add extra field',
    empty: (owner: string) =>
      `No ${owner.toLowerCase()} extra fields yet. Add one, like a care guide or a warranty.`,
    values: (n: number) => (n === 1 ? '1 value' : `${n} values`),
    listOf: (label: string) => `List of ${label.toLowerCase()}`,
    hidden: 'Hidden from storefront',
    edit: 'Edit',
    delete: 'Delete',
  },
  dialog: {
    addTitle: (owner: string) => `Add ${owner.toLowerCase()} extra field`,
    editTitle: 'Edit extra field',
    name: 'Name',
    namePlaceholder: 'Care guide',
    namespaceKeyHelp: 'Your theme reads it as metafields.namespace.key. It is fixed once you save.',
    namespaceKey: 'Theme key',
    description: 'Hint',
    storefront: 'Show on your store',
    storefrontHelp: 'Let your theme show this value.',
    fixed: 'What goes in it and the key are fixed once the extra field is saved.',
    save: 'Save',
    saving: 'Saving',
    cancel: 'Cancel',
    saved: 'Extra field saved',
    failed: 'Could not save. Check your connection and try again.',
  },
  remove: {
    title: (name: string) => `Delete ${name}?`,
    body: (n: number) =>
      n === 0
        ? 'Nothing is filled in yet.'
        : `The ${n === 1 ? 'value filled in on 1 item' : `values filled in on ${n} items`} will be deleted too.`,
    confirm: 'Delete',
    cancel: 'Cancel',
    done: 'Extra field deleted',
  },
  metaobjects: {
    heading: 'Content types',
    body: 'Your own kinds of content. Add their entries under Content, Content types.',
    add: 'Add content type',
    empty: 'No content types yet.',
    entries: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  },
  owners: { product: 'Product', collection: 'Collection' },
  loadFailed: 'Could not load. Reload the page to try again.',
} as const

export const metafieldsCardContent = {
  heading: 'Extra fields',
  empty: 'Add your own fields, like a care guide or warranty, to show more details.',
  manage: 'Manage extra fields',
  saveFirst: 'Save first, then fill in the extra fields.',
  save: 'Save extra fields',
  saving: 'Saving',
  saved: 'Extra fields saved',
  failed: 'Could not save. Check your connection and try again.',
} as const
