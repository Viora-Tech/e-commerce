/** Where the Customers page leaves the selected ids (JSON string array) for the sheet. */
export const CUSTOMERS_BULK_EDIT_IDS_KEY = 'customers-bulk-edit:ids'

/** Copy for the customers bulk editor (`/customers/bulk-edit`): a spreadsheet of customers. */
export const customersBulkEditContent = {
  title: 'Edit customers',
  back: 'Customers',
  summary: (n: number) => `${n} ${n === 1 ? 'customer' : 'customers'}`,
  hint: 'Click a cell and type. Paste from a spreadsheet, drag the corner to fill down, or press Ctrl+D to copy the cell above. Only subscribe someone to marketing if they agreed to it; each change is kept in their consent history.',
  loading: 'Loading customers',
  loadFailed: 'Could not load the customers',
  save: 'Save',
  saving: 'Saving',
  discard: 'Discard',
  unsaved: (n: number) => `Unsaved changes · ${n} ${n === 1 ? 'cell' : 'cells'}`,
  noChanges: 'Nothing changed yet',
  columns: {
    email: 'Email',
    name: 'Name',
    phone: 'Phone',
    tags: 'Tags',
    note: 'Note',
    acceptsMarketing: 'Email marketing',
    acceptsWhatsapp: 'WhatsApp marketing',
    acceptsSms: 'SMS marketing',
  },
  consent: { yes: 'Subscribed', no: 'Not subscribed' },
  /** "Change for all": one column changed on every row; Save still sends it. */
  setAll: {
    trigger: 'Change for all',
    title: (n: number) => `Change all ${n} ${n === 1 ? 'customer' : 'customers'}`,
    description:
      'Applies to every customer in this sheet. Nothing is saved until you click Save, so you can check it first.',
    column: 'Column',
    action: 'Change',
    value: 'Value',
    tagsPlaceholder: 'vip, diwali-2026',
    tagsHelp: 'Separate tags with commas.',
    notePlaceholder: 'Called about the Diwali sale',
    consentWarning:
      'Only subscribe customers who agreed to hear from you. Each change is kept in their consent history.',
    actions: {
      addTags: 'Add tags',
      removeTags: 'Remove tags',
      replaceTags: 'Replace all tags with',
      appendNote: 'Add to the end of the note',
      replaceNote: 'Replace the note with',
      clearNote: 'Clear the note',
      subscribe: 'Subscribe everyone',
      unsubscribe: 'Unsubscribe everyone',
    },
    apply: 'Apply to all',
    cancel: 'Cancel',
    applied: (n: number) => `Changed ${n} rows. Click Save to keep it.`,
  },
  noEmail: 'No email',
  validation: {
    name: 'Name is at most 200 characters',
    phone: 'Phone is at most 30 characters',
    note: 'Note is at most 2,000 characters',
    tagCount: 'At most 50 tags',
    tagLength: 'Each tag is at most 40 characters',
  },
  errors: {
    heading: (n: number) =>
      `${n} ${n === 1 ? 'cell needs' : 'cells need'} fixing before you can save`,
    rowFailed: (message: string) => `Not saved: ${message}`,
    saveFailed: 'Could not save the changes',
    rowLabel: (customer: string, column: string, message: string) =>
      `${customer} · ${column}: ${message}`,
    more: (n: number) => `and ${n} more`,
  },
  toasts: {
    saved: (ok: number, failed: number) =>
      failed > 0
        ? `Saved ${ok} ${ok === 1 ? 'customer' : 'customers'}, ${failed} failed`
        : `Saved ${ok} ${ok === 1 ? 'customer' : 'customers'}`,
  },
  empty: {
    heading: 'Nothing to edit',
    body: 'Select customers on the Customers page, then choose Bulk edit.',
    action: 'Back to customers',
  },
} as const
