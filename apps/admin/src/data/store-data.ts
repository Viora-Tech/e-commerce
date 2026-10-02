/**
 * Settings › Store details, bottom of the page: download a copy of everything the store holds,
 * and delete the store for good. Plain words: a merchant reading this may be closing
 * their business, so say exactly what happens and nothing more.
 */
export const storeDataContent = {
  export: {
    heading: 'Download your data',
    help: 'Get a copy of everything in your store: products, orders, customers, discounts, pages and settings. It comes as one zip file.',
    action: 'Export all data',
    working: 'Preparing your file…',
    started: 'We are preparing your file. It shows up here when it is ready.',
    failedToStart: 'Could not start the export. Try again.',
    recent: 'Recent exports',
    none: 'No exports yet.',
    download: 'Download',
    downloadFailed: 'Could not download the file. Make a new export.',
    filesNote:
      'Photos and invoice PDFs are not inside the zip; it lists the web address of each one.',
    keptFor: (days: number) => `Each file can be downloaded for ${days} days.`,
    status: {
      queued: 'Waiting',
      running: 'Preparing',
      ready: 'Ready',
      failed: 'Failed',
      expired: 'Expired',
    },
    summary: (rows: string, size: string) => `${rows} records, ${size}`,
    requestedBy: (email: string) => `Asked for by ${email}`,
  },
  danger: {
    heading: 'Delete store',
    help: 'Closes your store for good. Your website goes offline, and every product, order, customer, photo and setting is deleted. This cannot be undone.',
    ownerOnly: 'Only the store owner can delete the store.',
    action: 'Delete store',
    exportFirst: 'Download your data first if you may need it later.',
  },
  dialog: {
    title: 'Delete this store for good?',
    body: 'Everything in the store is deleted right away: products, orders, customers, photos, pages and settings. Your staff lose access. This cannot be undone.',
    typeToConfirm: (name: string) => `To confirm, type the store name: ${name}`,
    placeholder: 'Store name',
    mismatch: 'That is not the store name.',
    cancel: 'Keep my store',
    confirm: 'Delete store',
    deleting: 'Deleting…',
    done: 'Your store has been deleted.',
    failed: 'Could not delete the store. Nothing was deleted. Try again.',
  },
}
