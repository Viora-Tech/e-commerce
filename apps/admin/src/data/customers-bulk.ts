/** Copy for the customers list's bulk actions; part of customersContent. */

export const customersBulkContent = {
  addTag: 'Add tag',
  removeTag: 'Remove tag',
  export: 'Export selection',
  email: 'Email',
  /** The bulk bar's More menu: export, email, automations and delete. */
  more: 'More actions',
  tagHeading: 'Tag customers',
  tagLabel: 'Tag name',
  tagPlaceholder: 'vip',
  apply: 'Apply',
  cancel: 'Cancel',
  tagged: (n: number) => (n === 1 ? '1 customer updated' : `${n} customers updated`),
  noChange: 'Nothing to change',
  failed: 'Could not update the tags',
  marketing: 'Marketing',
  subscribe: (channel: string) => `Subscribe to ${channel}`,
  unsubscribe: (channel: string) => `Unsubscribe from ${channel}`,
  notSendable: (channel: string) => `${channel}: not set up yet, consent is still recorded`,
  consentNeedsPhone: 'Customers without a phone number are skipped.',
  consentNeedsEmail: 'Customers without an email are skipped.',
  /** "Save as segment" on the bulk bar (#998): keep the ticked customers as a segment. */
  saveSelection: {
    action: 'Save as segment',
    title: (n: number) =>
      n === 1 ? 'Save 1 customer as a segment' : `Save ${n} customers as a segment`,
    body: 'They get a tag with the segment name, and the segment lists everyone with that tag. Add or remove the tag later to change who is in it.',
    name: 'Segment name',
    placeholder: 'Diwali VIPs',
    tooLong: 'At most 40 characters, so it fits in a tag',
    save: 'Save segment',
    cancel: 'Cancel',
    saved: (name: string) => `Segment "${name}" saved`,
    open: 'Open',
    failed: 'Could not save the segment',
  },
  consentTitle: (granted: boolean, channel: string, n: number) => {
    const who = n === 1 ? '1 customer' : `${n} customers`
    return granted
      ? `Subscribe ${who} to ${channel} marketing?`
      : `Unsubscribe ${who} from ${channel} marketing?`
  },
  consentBody: (granted: boolean) =>
    granted
      ? 'Only do this if they agreed to hear from you, for example on a call or a signed form. Each change is kept in their consent history.'
      : 'They stop getting marketing on this channel. Each change is kept in their consent history.',
  consentConfirm: (granted: boolean) => (granted ? 'Subscribe' : 'Unsubscribe'),
  consentFailed: 'Could not update marketing consent',
  bulkEdit: 'Bulk edit',
  openFailed: 'Could not open the bulk editor',
  delete: 'Delete',
  deleteTitle: (n: number) => (n === 1 ? 'Delete 1 customer?' : `Delete ${n} customers?`),
  deleteBody:
    'Their records and notes go away. This cannot be undone. Customers with orders stay, so the order history keeps them.',
  deleteConfirm: 'Delete',
}
