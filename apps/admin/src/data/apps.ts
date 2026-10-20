/** Copy for the Apps page: plugins from commerce.config.ts a store can install. */
export const appsContent = {
  title: 'Apps',
  /** Header button that jumps to the App Store section (Figma 328:21275). */
  browseStore: 'Browse App Store',
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
  featured: 'Featured',
  /** "Recommended for <store>" strip: apps for what the store does not have yet. */
  recommended: {
    heading: (store: string) => `Recommended for ${store}`,
    intro: 'Picked from the tools your store does not have yet.',
    /** Why each app is suggested, by plugin id; an app without one shows its own description. */
    reasons: {
      delhivery: 'You have no courier connected yet: book pickups and print labels in one click.',
      shiprocket: 'You have no courier connected yet: compare couriers and save on labels.',
      rapidshyp: 'You have no courier connected yet: ship with one account and print labels.',
      reviews: 'Shoppers trust a product more with photo reviews on its page.',
      whatsapp: 'Send order updates on WhatsApp so shoppers ask you less where their parcel is.',
      'gst-invoices': 'Make a GST invoice for every order without typing it out.',
      'back-in-stock': 'Tell shoppers when a sold-out product is available again.',
      razorpay: 'Take UPI, cards and netbanking without sending shoppers away.',
      cashfree: 'Take UPI, cards and netbanking without sending shoppers away.',
    } as Record<string, string>,
  },
  previous: 'Previous app',
  next: 'Next app',
  goTo: (n: number) => `Show app ${n}`,
  sections: {
    installed: { title: 'Installed', intro: 'The tools running your store today.' },
    store: {
      title: 'App Store',
      intro: (brand: string) =>
        `Built by ${brand} and by trusted developers. What an app can do is explained before you install.`,
    },
  },
  store: {
    categories: 'Categories',
    all: 'All',
    builtBy: (brand: string) => `Built by ${brand}`,
    needsSetupFilter: 'Needs setup',
    noneInstalledHeading: 'Nothing installed yet',
    noneInstalledBody: 'Pick an app from the App Store below. It is ready in a few clicks.',
    installedBadge: 'Installed',
    /** Paid apps (Plan & billing): on a plan that does not include the app. */
    pricePerMonth: (price: string) => `${price} / month`,
    includedFrom: (plan: string) => `Included in ${plan} and up`,
    includedInPlan: 'Included in your plan',
    boughtUntil: (date: string) => `Paid until ${date}`,
    statusFilters: { all: 'All', installed: 'Installed', notInstalled: 'Not installed' },
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
    back: 'App Store',
    whatItDoes: 'What it does',
    access: 'What it can access',
    trust: 'You can remove its access any time from Apps.',
    details: 'Details',
    version: 'Version',
    category: 'Category',
    madeBy: 'Made by',
    type: 'Type',
    typeBuiltin: 'Built-in app',
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
    storage: { label: 'Files', href: '/content/files/storage' },
  },
  configure: (kind: string) => `Set up in ${kind}`,
  docs: 'Want FedEx, DHL or a new gateway? Write a plugin: docs/plugins.md',
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
      search: 'Search',
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
