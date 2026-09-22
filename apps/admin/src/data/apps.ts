/** Copy for the Apps page: plugins from commerce.config.ts a store can install. */
export const appsContent = {
  title: 'Apps',
  intro:
    'Payment gateways, couriers, messaging channels and apps ship as plugins. Install one to use it in this store; apps with their own screens appear under Apps in the sidebar.',
  installFirst: 'Install this app from Apps to use it in this store.',
  openApps: 'Open Apps',
  install: 'Install',
  uninstall: 'Uninstall',
  installed: 'Installed',
  builtIn: 'Built in',
  version: (v: string) => `v${v}`,
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
} as const

export type AppKind = keyof typeof appsContent.kinds
