/** Where the Orders page leaves the selected ids (JSON string array) for the sheet. */
export const BULK_EDIT_IDS_KEY = 'orders-bulk-edit:ids'

/** Copy for the orders bulk editor (`/orders/bulk-edit`): a spreadsheet of orders. */
export const ordersBulkEditContent = {
  title: 'Edit orders',
  back: 'Orders',
  summary: (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`,
  hint: 'Click a cell and type. Paste from a spreadsheet, drag the corner to fill down, or press Ctrl+D to copy the cell above. Imported orders only allow tag changes.',
  loading: 'Loading orders',
  loadFailed: 'Could not load the orders',
  save: 'Save',
  saving: 'Saving',
  discard: 'Discard',
  unsaved: (n: number) => `Unsaved changes · ${n} ${n === 1 ? 'cell' : 'cells'}`,
  noChanges: 'Nothing changed yet',
  columns: {
    number: 'Order #',
    placed: 'Placed',
    name: 'Customer name',
    email: 'Email',
    phone: 'Phone',
    line1: 'Address line 1',
    line2: 'Address line 2',
    city: 'City',
    stateCode: 'State',
    pincode: 'Pincode',
    tags: 'Tags',
    mark: 'Mark as',
  },
  marks: {
    paid: 'Paid',
    fulfilled: 'Fulfilled',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  },
  none: '—',
  validation: {
    email: 'Enter a valid email',
    pincode: 'Pincode is 6 digits',
    phone: 'Phone is at most 30 characters',
    name: 'Name is at most 120 characters',
    tagCount: 'At most 20 tags',
    tagLength: 'Each tag is at most 40 characters',
  },
  errors: {
    heading: (n: number) =>
      `${n} ${n === 1 ? 'cell needs' : 'cells need'} fixing before you can save`,
    rowFailed: (message: string) => `Not saved: ${message}`,
    saveFailed: 'Could not save the changes',
    rowLabel: (order: string, column: string, message: string) =>
      `#${order} · ${column}: ${message}`,
    more: (n: number) => `and ${n} more`,
  },
  toasts: {
    saved: (ok: number, failed: number) =>
      failed > 0
        ? `Saved ${ok} ${ok === 1 ? 'order' : 'orders'}, ${failed} failed`
        : `Saved ${ok} ${ok === 1 ? 'order' : 'orders'}`,
  },
  empty: {
    heading: 'Nothing to edit',
    body: 'Select orders on the Orders page, then choose Bulk edit.',
    action: 'Back to orders',
  },
} as const
