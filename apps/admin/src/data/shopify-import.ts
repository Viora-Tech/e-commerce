import type { CsvResource, ImportResource, RunStatus } from '@commerce/plugin-shopify-import/client'

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

export const shopifyImportContent = {
  base: '/apps/shopify-import',
  resources: {
    products: 'Products',
    collections: 'Collections',
    customers: 'Customers',
    orders: 'Orders',
    pages: 'Pages',
    articles: 'Blog posts',
    menus: 'Menus',
    redirects: 'URL redirects',
  } satisfies Record<ImportResource, string>,
  previewReady: 'Preview ready',
  status: {
    queued: 'Queued',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
  } satisfies Record<RunStatus, string>,

  home: {
    title: 'Import from Shopify',
    subtitle:
      'Bring your catalogue, customers and order history over. Every import is previewed first and can be run again safely.',
    csvTitle: 'Upload CSV files',
    csvBody:
      'Use the Products, Customers and Orders exports from your Shopify admin. Good for a first look or a small store.',
    csvAction: 'Upload a file',
    apiTitle: 'Connect your Shopify store',
    apiBody:
      'Paste an Admin API token from a custom app to bring everything over, including collections, pages, blog posts, menus and redirects.',
    apiAction: 'Connect store',
    apiConnected: (shop: string) => `Connected to ${shop}`,
    historyTitle: 'Import history',
    columns: {
      started: 'Started',
      source: 'Source',
      what: 'Imported',
      status: 'Status',
      result: 'Result',
    },
    source: { csv: (file: string | null) => file ?? 'CSV file', api: 'Shopify store' },
    preview: 'Preview',
    empty: {
      heading: 'No imports yet',
      body: 'Upload a Shopify CSV or connect your store. You will see what would change before anything is written.',
    },
    result: (created: number, updated: number, failed: number) =>
      [
        created ? `${created.toLocaleString('en-IN')} new` : null,
        updated ? `${updated.toLocaleString('en-IN')} updated` : null,
        failed ? `${failed.toLocaleString('en-IN')} failed` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'Nothing to import',
  },

  csv: {
    title: 'Upload a Shopify CSV',
    subtitle: 'Choose what the file holds, then preview. Nothing is written until you confirm.',
    kindHeading: 'What is in the file?',
    kinds: {
      products: {
        label: 'Products',
        help: 'Shopify admin, Products, Export, "All products" as CSV for Excel or plain CSV. Variants, prices, stock, images, SEO and an HSN metafield column are read.',
      },
      customers: {
        label: 'Customers',
        help: 'Shopify admin, Customers, Export. Addresses, email marketing consent, notes and tags are read; customers are matched by email.',
      },
      orders: {
        label: 'Orders',
        help: 'Shopify admin, Orders, Export. Orders arrive as read-only history: they do not change stock, send messages or create invoices.',
      },
    } satisfies Record<CsvResource, { label: string; help: string }>,
    fileHeading: 'File',
    choose: 'Choose CSV file',
    replace: 'Choose another file',
    none: 'No file chosen',
    size: (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`,
    tooBig: 'This file is larger than 15 MB. Split it, or connect your store instead.',
    notCsv: 'Choose a .csv file exported from Shopify.',
    preview: 'Preview import',
    failed: 'Could not upload the file',
  },

  connect: {
    title: 'Connect your Shopify store',
    subtitle:
      'We read your store with a custom app token. The token is stored encrypted and never shown again.',
    stepsHeading: 'Create the token in Shopify',
    steps: [
      'In your Shopify admin, open Settings, Apps and sales channels, Develop apps, and create an app.',
      'Under Configuration, give the Admin API these read scopes: read_products, read_inventory, read_customers, read_orders, read_all_orders, read_content and read_online_store_navigation.',
      'Install the app, then reveal the Admin API access token once and paste it here.',
    ],
    domain: 'Store address',
    domainPlaceholder: 'your-store.myshopify.com',
    token: 'Admin API access token',
    tokenPlaceholder: 'shpat_...',
    tokenHelp: 'Starts with shpat_. Read-only scopes are enough.',
    submit: 'Connect',
    connected: 'Store connected',
    connectFailed: 'Could not connect',
    connection: 'Connection',
    shop: 'Store',
    tokenLabel: 'Token',
    verified: 'Checked',
    disconnect: 'Disconnect',
    disconnected: 'Store disconnected',
    chooseHeading: 'What to import',
    chooseHelp: 'Products come first so collections and orders can link to them.',
    scope: (s: string) => `Needs ${s}`,
    preview: 'Preview import',
    previewFailed: 'Could not start the preview',
  },

  run: {
    back: 'Imports',
    title: (preview: boolean) => (preview ? 'Import preview' : 'Import'),
    from: (source: string) => `From ${source}`,
    waiting: 'Waiting for the worker to pick this up.',
    running: 'Working through your data. You can leave this page; it keeps going.',
    previewDone: 'Nothing has been written yet. Check the counts and problems below, then import.',
    importDone:
      'Import finished. Running it again updates what it created instead of duplicating it.',
    failed: 'The import stopped.',
    importNow: 'Import now',
    runAgain: 'Run again',
    tryAgain: 'Try again',
    started: 'Import started',
    startFailed: 'Could not start the import',
    progressHeading: 'By type',
    columns: {
      what: 'Type',
      progress: 'Progress',
      created: 'New',
      updated: 'Updated',
      skipped: 'Skipped',
      failed: 'Failed',
    },
    counted: (processed: number, total: number) =>
      `${processed.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`,
    sampleHeading: 'Sample of what will change',
    sampleAction: { create: 'New', update: 'Update', skip: 'Skip' },
    issuesHeading: (n: number) => plural(n, 'problem', 'problems'),
    issuesNone: 'No problems found.',
    issueColumns: { where: 'Where', what: 'Record', message: 'Problem' },
    line: (n: number) => `Line ${n}`,
    notFound: 'This import no longer exists.',
    previous: 'Previous page',
    next: 'Next page',
  },
} as const
