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
