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
  /** Shown on a `kind: 'builtin'` card: made by us, nothing else to sign up for. */
  builtByPlatform: 'Built by Waimers',
  /** Shown on a `kind: 'connection'` card: which outside company this links to. */
  byCompany: (company: string) => `by ${company}`,
  connection: {
    connected: 'Connected',
    notConnected: 'Not connected',
  },
  gallery: {
    searchPlaceholder: 'Search apps',
    filters: { all: 'All', installed: 'Installed' },
    /** Category slugs from a manifest's `category`, in plain words. */
    categories: {
      invoicing: 'Invoicing',
      migration: 'Data import',
      marketing: 'Marketing',
      storage: 'Storage',
      payments: 'Payments',
      shipping: 'Shipping',
      messages: 'Messages',
      analytics: 'Analytics',
    } as Record<string, string>,
    categoryFallback: (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1),
    noResultsHeading: 'No apps match',
    noResultsBody: 'Try a different search or filter.',
    kebabLabel: (name: string) => `More actions for ${name}`,
    /** Section 1: features we designed, no outside account. */
    builtin: {
      title: 'Built-in apps',
      intro: 'Made by us. Turn one on and start using it — no account to set up.',
    },
    /** Section 2: links to another company's service. */
    connections: {
      title: 'Connections',
      intro:
        "Link your store to another company's account for storage, payments, shipping and messages.",
    },
  },
  storage: {
    migrate: {
      action: (name: string) => `Move existing files to ${name}`,
      confirmTitle: (name: string) => `Move existing files to ${name}?`,
      confirmBody:
        'Every file already on Local disk is copied over and checked before the original is removed. You can leave this page — it keeps going in the background.',
      confirm: 'Move files',
      cancel: 'Cancel',
      started: 'Moving files in the background',
      failedToStart: 'Could not start the move',
      progress: (done: number, total: number) => `Moved ${done} of ${total} files`,
      progressWithFailed: (done: number, total: number, failed: number) =>
        `Moved ${done} of ${total} files, ${failed} failed`,
      done: 'All files moved',
      failed: 'The move stopped with errors. Files not yet moved are still safe on Local disk.',
    },
  },
} as const

export type AppKind = keyof typeof appsContent.kinds
