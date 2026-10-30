import type { SortableListLabels } from '@commerce/ui/sortable'

/** Copy shared by small controls that several sections reuse. */
export const copyButtonContent = {
  copy: (what: string) => `Copy ${what}`,
  copied: (what: string) => `${what} copied`,
} as const

/** Cancel label the global ConfirmDialog and FormDialog fall back to. */
export const dialogContent = {
  cancel: 'Cancel',
  close: 'Close',
} as const

/** "Leave without saving?": asked when unsaved changes would be lost (LeaveGuard). */
export const leaveGuardContent = {
  title: 'Leave without saving?',
  body: 'Your changes on this page are not saved yet. If you leave now, they are lost.',
  leave: 'Leave page',
  stay: 'Keep editing',
} as const

/** The red asterisk on a required field's label; screen readers hear the word instead. */
export const requiredMarkContent = {
  required: 'required',
} as const

/** The Call / WhatsApp buttons under any customer's contact details. */
export const contactContent = {
  call: 'Call',
  whatsapp: 'WhatsApp',
} as const

/**
 * Screen reader copy for every list reordered by dragging its grip (mouse, touch or keyboard):
 * metafield fields and rows, footer menus, email blocks, automation steps, locations, invoices.
 */
export const reorderLabels: SortableListLabels = {
  instructions: 'Press space to pick up an item, arrow keys to move it, space again to drop it.',
  handle: (title) => `Drag to reorder ${title}`,
  picked: (title) => `Picked up ${title}`,
  moved: (title, position, total) => `${title} moved to position ${position} of ${total}`,
  dropped: (title, position, total) => `${title} dropped at position ${position} of ${total}`,
  cancelled: (title) => `Move of ${title} cancelled`,
}

/**
 * A request the API turned down as invalid ("Input validation failed"), in plain words:
 * which field and why. `lib/api-client.ts` puts it on every such error, so any toast or alert
 * that shows the error's message names the field.
 */
export const validationContent = {
  /** "Collections (item 2): not a valid ID. Title: required" */
  issue: (field: string, reason: string) => `${field}: ${reason}`,
  /** The rest, after the first three. */
  more: (n: number) => `${n} more to fix`,
  /** A position in a list, counted from 1. */
  item: (n: number) => `item ${n}`,
  /** No path: the request as a whole. */
  request: 'This request',
  notId: 'not a valid ID',
  required: 'required',
  tooLong: (max: number) => `too long, keep it to ${max} characters or fewer`,
  tooShort: (min: number) => `too short, at least ${min} characters`,
  tooMany: (max: number) => `too many, ${max} at most`,
  tooFew: (min: number) => `needs at least ${min}`,
  tooBig: (max: number) => `must be ${max} or less`,
  tooSmall: (min: number) => `must be at least ${min}`,
  notAllowed: 'not one of the allowed values',
  badFormat: 'not in the right format',
  /** Plain names of fields the API uses across screens; other names are spelled out. */
  fields: {
    collectionIds: 'Collections',
    collectionId: 'Collection',
    productIds: 'Products',
    productId: 'Product',
    variantId: 'Variant',
    title: 'Title',
    handle: 'URL handle',
    description: 'Description',
    seoTitle: 'Search engine title',
    seoDescription: 'Search engine description',
    imageMediaId: 'Image',
    mediaIds: 'Media',
    vendor: 'Vendor',
    categoryId: 'Category',
    productType: 'Product type',
    tags: 'Tags',
    options: 'Options',
    variants: 'Variants',
    sku: 'SKU',
    pricePaise: 'Price',
    mrpPaise: 'Compare-at price',
    costPaise: 'Cost',
    weightGrams: 'Weight',
    email: 'Email',
    phone: 'Phone',
    name: 'Name',
  } as Record<string, string>,
}
