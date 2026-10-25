import { siteConfig } from '@commerce/config/site'
/** Copy for the Apps page: plugins from commerce.config.ts a store can install. */
export const appsContent = {
  title: 'Apps',
  /** The App Store website, where apps are browsed and installed. Links to it open a new tab. */
  appStore: {
    browse: 'Browse the App Store',
    more: 'Find more apps',
    newTab: '(opens in a new tab)',
  },
  intro:
    'Add tools to your store, like invoicing, importers and marketing apps. Each one is a plugin you can turn on or off any time.',
  /** The plain-language line under the page title. Empty parts are left out. */
  summary: {
    installed: (n: number) => (n === 1 ? '1 app installed' : `${n} apps installed`),
    needsSetup: (n: number) => `${n} needs setup`,
    none: 'No apps installed yet',
  },
  learnMore: 'Learn more',
  active: 'Active',
  settings: 'Settings',
  needsSetup: 'Needs setup',
  store: {
    builtBy: (brand: string) => `Built by ${brand}`,
  },
  viewGuide: 'View setup guide',
  connectedHeading: 'Connected',
  connectedBody: 'Your account works and is saved.',
  openApp: 'Open app',
  setupBanner: {
    eyebrow: 'Needs setup',
    title: 'Finish setting this app up',
    body: 'It is installed but not connected yet, so it cannot do its job.',
    action: 'Connect now',
  },
  /** An installed app with a recorded failure (its sync, a hook or a job keeps failing). */
  errorBanner: {
    eyebrow: 'Problem',
    title: 'This app needs your attention',
    action: 'Fix it',
  },
  statusError: 'Error',
  /** The installed app's ⋯ menu: back to the Installed apps list. */
  allInstalled: 'All installed apps',
  listing: {
    back: 'Installed apps',
    whatItDoes: 'What it does',
    access: 'What it can access',
    trust: 'You can remove its access any time from Apps.',
    details: 'Details',
    version: 'Version',
    category: 'Category',
    madeBy: 'Made by',
    type: 'Type',
    typeBuiltin: `${siteConfig.brand.name} app`,
    typeConnection: 'Connection to another service',
    builtOn: 'Built on',
  },
  permissions: {
    title: (name: string) => `Install ${name}?`,
    intro: 'Here is what this app will be able to do in your store.',
    heading: 'This app will',
    kindLine: {
      payments: (labels: string) => `Take payments through ${labels}`,
      shipping: (labels: string) => `Book shipments and print labels with ${labels}`,
      notifications: (labels: string) => `Send messages to your customers through ${labels}`,
      storage: (labels: string) => `Store your files with ${labels}`,
    },
    hooks: 'Read order and customer events so it can react to them',
    fields: 'Add its own fields to your products',
    pages: 'Add its own screens under Apps in your admin',
    nothingElse: 'It cannot see your passwords or change your staff.',
    credits: (names: string) => `Built on ${names}`,
    cancel: 'Cancel',
    confirm: 'Install',
  },
  installFirst: 'Install this app from Apps to use it in this store.',
  /** `/apps/install` for a member of several stores: which store the app goes into. */
  installStore: {
    title: (app: string) => `Install ${app} in which store?`,
    intro: 'You belong to more than one store. Pick the one to add this app to.',
    choose: (store: string) => `Install in ${store}`,
    current: 'Open now',
    failed: 'Could not switch stores. Try again.',
  },
  openApps: 'Open Apps',
  install: 'Install',
  open: 'Open',
  uninstall: 'Uninstall',
  installed: 'Installed',
  builtIn: 'Built in',
  version: (v: string) => `v${v}`,
  builtWith: 'Built with',
  creditLabel: (name: string, license: string) => `${name} (${license})`,
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
  kinds: {
    payments: { label: 'Payments', href: '/settings/payments' },
    shipping: { label: 'Shipping', href: '/settings/shipping' },
    notifications: { label: 'Notifications', href: '/settings/notifications' },
    storage: { label: 'Files', href: '/content/files/storage' },
  },
  configure: (kind: string) => `Set up in ${kind}`,
  /** Shown on a `kind: 'builtin'` card: made by us, nothing else to sign up for. */
  builtByPlatform: `${siteConfig.brand.name} app`,
  /** Shown on a `kind: 'connection'` card: which outside company this links to. */
  byCompany: (company: string) => `by ${company}`,
  connection: {
    connected: 'Connected',
    notConnected: 'Not connected',
  },
  gallery: {
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
      search: 'Search',
      operations: 'Store operations',
    } as Record<string, string>,
    categoryFallback: (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1),
    kebabLabel: (name: string) => `More actions for ${name}`,
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
