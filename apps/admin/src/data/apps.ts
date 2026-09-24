/** Copy for the Apps page: plugins from commerce.config.ts a store can install. */
export const appsContent = {
  title: 'Apps',
  intro:
    'Add tools to your store, like invoicing, importers and marketing apps. Each one is a plugin you can turn on or off any time.',
  installFirst: 'Install this app from Apps to use it in this store.',
  openApps: 'Open Apps',
  install: 'Install',
  open: 'Open',
  uninstall: 'Uninstall',
  installed: 'Installed',
  builtIn: 'Built in',
  version: (v: string) => `v${v}`,
  builtWith: 'Built with',
  creditLabel: (name: string, license: string) => `${name} (${license})`,
  empty: 'No plugins are listed in commerce.config.ts.',
  loadFailed: 'Could not load apps',
  actionFailed: 'Could not update app',
  installedToast: (name: string) => `${name} installed`,
  uninstalledToast: (name: string) => `${name} uninstalled`,
  confirmUninstall: {
    title: (name: string) => `Uninstall ${name}?`,
    body: 'Its providers are switched off for this store. Saved credentials are kept until you remove them from Settings.',
    cancel: 'Keep',
    confirm: 'Uninstall',
  },
  emptyHeading: 'No apps available',
  kinds: {
    payments: { label: 'Payments', href: '/settings/payments' },
    shipping: { label: 'Shipping', href: '/settings/shipping' },
    notifications: { label: 'Notifications', href: '/settings/notifications' },
    storage: { label: 'Files', href: '/settings/files' },
  },
  configure: (kind: string) => `Set up in ${kind}`,
  docs: 'Want FedEx, DHL, S3 or a new gateway? Write a plugin: docs/plugins.md',
  gallery: {
    searchPlaceholder: 'Search apps',
    filters: { all: 'All', installed: 'Installed' },
    /** Category slugs from a manifest's `category`, in plain words. */
    categories: {
      invoicing: 'Invoicing',
      migration: 'Data import',
      marketing: 'Marketing',
    } as Record<string, string>,
    categoryFallback: (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1),
    noResultsHeading: 'No apps match',
    noResultsBody: 'Try a different search or filter.',
    builtInTitle: 'Built in',
    builtInIntro:
      'These come with your store already. Turn one on to use it for payments, shipping or notifications.',
    kebabLabel: (name: string) => `More actions for ${name}`,
  },
} as const

export type AppKind = keyof typeof appsContent.kinds
