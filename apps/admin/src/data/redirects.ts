export type RedirectListItem = {
  id: string
  path: string
  target: string
  source: 'manual' | 'import' | 'auto'
  createdAt: string | Date
  updatedAt: string | Date
}

export const redirectsContent = {
  title: 'Redirects',
  summary: (n: number) =>
    n === 0
      ? 'Send shoppers from an old address to a new one.'
      : `${n} ${n === 1 ? 'redirect' : 'redirects'} sending visitors to the right page`,
  resource: { singular: 'redirect', plural: 'redirects' },
  intro:
    'Send shoppers and search engines from an old address to a new one with a permanent (301) redirect.',
  back: 'Menus',
  add: 'Add redirect',
  viewRedirects: 'URL redirects',
  columns: {
    path: 'Redirect from',
    target: 'Redirect to',
    source: 'Source',
    updated: 'Updated',
  },
  source: { manual: 'Manual', import: 'Imported', auto: 'Handle changed' },
  empty: {
    heading: 'Redirect old links',
    body: 'When a product, collection or page moves, add a redirect so saved links and search results still land somewhere useful. Imports from Shopify add them for you.',
    searchHeading: 'No redirects match',
  },
  dialog: {
    createTitle: 'Create URL redirect',
    editTitle: 'Edit URL redirect',
    path: 'Redirect from',
    pathPlaceholder: '/products/old-name',
    pathHelp: 'The old path on your store. Case and a trailing slash do not matter.',
    target: 'Redirect to',
    targetPlaceholder: '/products/new-name',
    targetHelp: 'A path on your store or a full web address.',
    cancel: 'Cancel',
    save: 'Save redirect',
    saved: 'Redirect saved',
    failed: 'Could not save the redirect',
  },
  actions: {
    label: 'Redirect actions',
    edit: 'Edit',
    delete: 'Delete',
    deleteSelected: (n: number) => `Delete ${n} ${n === 1 ? 'redirect' : 'redirects'}`,
    deleted: (n: number) => `${n} ${n === 1 ? 'redirect' : 'redirects'} deleted`,
    deleteFailed: 'Could not delete',
    confirmTitle: (n: number) => `Delete ${n} ${n === 1 ? 'redirect' : 'redirects'}?`,
    confirmBody: 'Visitors to these old paths will see a page not found instead.',
    cancel: 'Cancel',
  },
  csv: {
    export: 'Export',
    exported: 'Redirects downloaded',
    exportFailed: 'Could not export the redirects',
    import: 'Import',
    title: 'Import redirects',
    body: 'Upload a CSV with two columns, Redirect from and Redirect to. A Shopify redirects export works as it is. A path you already redirect takes the new target.',
    choose: 'Choose CSV file',
    reading: 'Checking the file…',
    ready: (n: number) =>
      n === 1 ? '1 redirect is ready to import.' : `${n} redirects are ready to import.`,
    problems: (n: number) => (n === 1 ? '1 row will be skipped:' : `${n} rows will be skipped:`),
    line: (line: number, reason: string) => `Line ${line}: ${reason}`,
    more: (n: number) => `and ${n} more`,
    nothing: 'Nothing in this file can be imported.',
    confirm: (n: number) => (n === 1 ? 'Import 1 redirect' : `Import ${n} redirects`),
    importing: 'Importing…',
    cancel: 'Cancel',
    done: (created: number, updated: number) => `${created} added, ${updated} updated`,
    failed: 'Could not import the file',
    tooBig: 'That file is too big. Split it into files of up to 5,000 redirects.',
  },
} as const
