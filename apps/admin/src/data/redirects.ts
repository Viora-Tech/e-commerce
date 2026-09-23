export type RedirectListItem = {
  id: string
  path: string
  target: string
  source: 'manual' | 'import'
  createdAt: string | Date
  updatedAt: string | Date
}

export const redirectsContent = {
  title: 'URL redirects',
  intro:
    'Send shoppers and search engines from an old address to a new one with a permanent (301) redirect.',
  back: 'Menus',
  add: 'Create URL redirect',
  viewRedirects: 'URL redirects',
  columns: {
    path: 'Redirect from',
    target: 'Redirect to',
    source: 'Source',
    updated: 'Updated',
  },
  source: { manual: 'Manual', import: 'Imported' },
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
} as const
