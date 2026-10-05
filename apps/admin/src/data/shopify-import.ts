import type {
  AuthMode,
  CsvResource,
  ImportResource,
  LeftBehindReason,
  RunStatus,
  ScopeHandle,
} from '@commerce/plugin-shopify-import/client'

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

/** Every read scope the import asks for, in the order the Dev Dashboard lists them. */
export const SCOPE_LIST =
  'read_products, read_inventory, read_customers, read_orders, read_all_orders, read_content, read_online_store_navigation, read_files, read_metaobject_definitions, read_metaobjects, read_discounts and read_gift_cards'

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
    files: 'Files',
    metaobjects: 'Content types and entries',
    metafields: 'Extra fields',
    discounts: 'Discounts',
    gift_cards: 'Gift cards',
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
      'Connect a Shopify app (or an existing Admin API token) to bring everything over, including collections, pages, blog posts, menus, redirects, files, content types, extra fields, discounts and gift cards.',
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
    failedNoReason: 'Stopped before finishing. Open it to see why.',
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
      'Your credentials are stored encrypted and never shown again. Choose one of the two ways below.',
    mode: {
      app: 'Connect with your Shopify app (recommended)',
      token: 'I already have an Admin API token',
    },
    app: {
      badge: 'Recommended',
      intro:
        'Shopify stopped allowing new custom apps from the admin on 1 January 2026. Apps are now made in the Dev Dashboard instead — it takes about five minutes.',
      stepsHeading: 'Create the app in the Dev Dashboard',
      steps: [
        'Open the Shopify Dev Dashboard (partners.shopify.com or dev.shopify.com) and create an app.',
        `Under Configuration, give the Admin API these read scopes: ${SCOPE_LIST}.`,
        'Release a version of the app.',
        'Install the app on your own store from the Dev Dashboard.',
        'Copy the client ID and client secret from the app’s API credentials page and paste them below.',
      ],
      docsLink:
        'https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant',
      docsLabel: 'How the client credentials grant works',
      clientId: 'Client ID',
      clientIdPlaceholder: 'Paste the client ID',
      clientSecret: 'Client secret',
      clientSecretPlaceholder: 'Paste the client secret',
      clientSecretHelp:
        'Kept encrypted. We exchange it for a token that Shopify expires after 24 hours, and refresh it for you automatically.',
      submit: 'Connect',
      oauthNote:
        'A one-click "Connect Shopify" button needs a public web address to send merchants back to, so it is a follow-up once the admin is deployed. This is the way to connect your own store today.',
    },
    token: {
      stepsHeading: 'Create the token in Shopify',
      steps: [
        'In your Shopify admin, open Settings, Apps and sales channels, Develop apps, and create an app. (New from 1 January 2026? Shopify no longer allows this here — use the app method instead.)',
        `Under Configuration, give the Admin API these read scopes: ${SCOPE_LIST}.`,
        'Install the app, then reveal the Admin API access token once and paste it here.',
      ],
      domain: 'Store address',
      domainPlaceholder: 'your-store.myshopify.com',
      token: 'Admin API access token',
      tokenPlaceholder: 'shpat_...',
      tokenHelp: 'Starts with shpat_. Read-only scopes are enough.',
      submit: 'Connect',
    },
    domain: 'Store address',
    domainPlaceholder: 'your-store.myshopify.com',
    connected: 'Store connected',
    connectFailed: 'Could not connect',
    connection: 'Connection',
    shop: 'Store',
    tokenLabel: 'Credential',
    authMode: {
      legacy: 'Admin API token',
      client_credentials: 'Shopify app (Dev Dashboard)',
    } satisfies Record<AuthMode, string>,
    verified: 'Checked',
    disconnect: 'Disconnect',
    disconnected: 'Store disconnected',
    testHeading: 'Test connection',
    test: 'Test connection',
    testFailed: 'Could not test the connection',
    scopesGranted: 'Granted',
    scopesMissing: 'Missing',
    scopesAllGranted: 'Every scope this import needs is granted.',
    scopeNames: {
      read_products: 'Read products',
      read_inventory: 'Read inventory',
      read_customers: 'Read customers',
      read_orders: 'Read orders',
      read_all_orders: 'Read orders older than 60 days',
      read_content: 'Read pages and blog posts',
      read_online_store_navigation: 'Read menus and redirects',
      read_files: 'Read files',
      read_metaobject_definitions: 'Read content types',
      read_metaobjects: 'Read entries',
      read_discounts: 'Read discounts',
      read_gift_cards: 'Read gift cards',
    } satisfies Record<ScopeHandle, string>,
    chooseHeading: 'What to import',
    chooseHelp:
      'Products come first so collections, orders, discounts and extra fields can link to them.',
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
    previewReuse:
      'Import now uses what this preview already read from Shopify, and only asks Shopify for what changed since. Import within a day to save the wait.',
    usingPreview: (when: string, changes: number) =>
      `Using the preview from ${when} + ${plural(changes, 'change', 'changes')} since.`,
    importDone:
      'Import finished. Running it again updates what it created instead of duplicating it.',
    failed: 'The import stopped.',
    importNow: 'Import now',
    runAgain: 'Run again',
    tryAgain: 'Try again',
    started: 'Import started',
    startFailed: 'Could not start the import',
    phase: {
      products: 'Asking Shopify to prepare your products…',
      customers: 'Asking Shopify to prepare your customers…',
      orders: 'Asking Shopify to prepare your orders…',
    },
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
    retryMissed: (n: number) =>
      n === 1
        ? 'Retry the 1 that was missed'
        : `Retry the ${n.toLocaleString('en-IN')} that were missed`,
    retryFailed: 'Could not start the retry',
    importAll: 'Import everything again',
    retrying: 'Retrying only what the last import missed. Everything else is left as it is.',
    remainingRun:
      'Importing only what was not here yet, or had a problem last time. Everything else is left as it is.',
    now: (what: string, done: number, total: number) =>
      `${what}: ${done.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`,
    problems: {
      showAll: 'Show every record',
      showGrouped: 'Group by cause',
      unit: (n: number) =>
        `${plural(n, 'record', 'records')} to retry: one record can have several problems, such as several images.`,
      example: 'For example:',
      retryable: (n: number) => `${plural(n, 'record', 'records')} can be retried`,
      fix: { storage: 'Connect storage', scope: 'Add the access' },
      cause: {
        storage: (n: number) =>
          `${plural(n, 'image or file', 'images and files')} not copied: file storage isn’t working`,
        scope: (n: number) => `${plural(n, 'type', 'types')} Shopify didn’t let us read`,
        order_number: (n: number) =>
          `${plural(n, 'order', 'orders')} skipped: the order number is already used here`,
        image: (n: number) => `${plural(n, 'image', 'images')} couldn’t be copied`,
        file: (n: number) => `${plural(n, 'file', 'files')} couldn’t be copied`,
        record: (n: number) => `${plural(n, 'record', 'records')} couldn’t be saved`,
        note: (n: number) =>
          `${plural(n, 'note', 'notes')} about what changed or stayed in Shopify`,
      },
    },
  },

  /** The importer's main page: what Shopify has, what is here, what is still missing. */
  remaining: {
    heading: 'What’s left to import',
    subtitle:
      'Shopify’s numbers next to what is already here, so you can see what is still missing.',
    notConnected: 'Connect your Shopify store to see what is left to import.',
    loadFailed: 'Couldn’t check what is left. Reload the page to try again.',
    columns: { what: 'Type', inShopify: 'In Shopify', here: 'Here', status: 'Status' },
    state: {
      done: 'Done',
      missing: 'Missing',
      not_copied: 'Not copied',
      never: 'Never imported',
      unknown: 'Not checked yet',
    },
    missingCount: (n: number) => `${n.toLocaleString('en-IN')} missing`,
    notCopiedCount: (n: number) => `${n.toLocaleString('en-IN')} not copied`,
    images: 'Product images',
    action: {
      import: (n: number) => `Import ${n.toLocaleString('en-IN')}`,
      images: 'Copy images',
      files: 'Copy files',
    },
    importRemaining: 'Import remaining',
    allHere: 'Everything is here',
    fromShopify: 'Counted live from Shopify',
    fromPreview: (when: string) =>
      `Numbers Shopify doesn’t count for us are from the ${when} preview`,
    lastImport: (when: string) => `Last import ${when}`,
    nothingYet: 'Nothing imported yet',
    previewReused: (when: string) =>
      `The preview from ${when} will be reused, so the next import starts faster.`,
    started: 'Import started',
    startFailed: 'Couldn’t start the import',
  },

  /** "Before you import": what is not set up yet, with where to fix it. */
  preflight: {
    heading: 'Before you import',
    fix: 'Fix this',
    blocked: 'Can’t be imported until this is fixed',
    checks: {
      storage: {
        title: 'No file storage connected',
        help: 'Images and files can’t be copied: no storage is connected. Connect Cloudflare R2 or Amazon S3 first, or images will be skipped.',
      },
      connection: {
        title: 'Shopify isn’t answering',
        help: 'We couldn’t check your Shopify connection. Test it again on the connect page.',
      },
      scope: {
        title: 'Shopify access missing',
        help: 'Your Shopify app can’t read this yet. Add the missing access in Shopify, then test the connection again.',
      },
      all_orders: {
        title: 'Only recent orders',
        help: 'Without “Read all orders” Shopify shares only the last 60 days of orders.',
      },
      needs_products: {
        title: 'Products aren’t here yet',
        help: 'Tick products too. Without them, order lines point to a placeholder item and collections and discounts come over empty.',
      },
      needs_customers: {
        title: 'Customers aren’t here yet',
        help: 'Tick customers too, or gift cards for unknown customers are skipped.',
      },
    },
  },

  /** "What stays in Shopify": one plain sentence per reason (`d` is the Shopify type or owner). */
  left: {
    heading: 'What stays in Shopify',
    intro:
      'These were not brought over, or arrived changed. The problems list below names each record.',
    owners: {
      PRODUCTVARIANT: 'variants',
      CUSTOMER: 'customers',
      ORDER: 'orders',
      PAGE: 'pages',
      ARTICLE: 'blog posts',
      BLOG: 'blogs',
      SHOP: 'your store',
      LOCATION: 'locations',
      COMPANY: 'companies',
    } as Record<string, string>,
    reasons: {
      metafield_owner: (n: number, owner: string) =>
        `${plural(n, 'extra field value', 'extra field values')} on ${owner}. Extra fields here are on products and collections only for now.`,
      field_type: (n: number, type: string) =>
        `${plural(n, 'field', 'fields')} of the Shopify type “${type}”, which has no match here yet. Their values stay in Shopify.`,
      reference_target: (n: number, name: string) =>
        `${plural(n, 'field', 'fields')} (${name}) link to entries of a content type that was not imported.`,
      field_value: (n: number) =>
        `${plural(n, 'value', 'values')} did not fit their field, such as a link to something that was not imported.`,
      time_dropped: (n: number) =>
        `${plural(n, 'date and time field keeps', 'date and time fields keep')} the date only.`,
      link_label: (n: number) =>
        `${plural(n, 'link field keeps', 'link fields keep')} the web address, not the link text.`,
      file_type: (n: number, kind: string) =>
        `${plural(n, `${kind} file`, `${kind} files`)}. Files holds pictures and mp4 videos for now, so download these from Shopify.`,
      video_too_large: (n: number) =>
        `${plural(n, 'video is', 'videos are')} over 100 MB in every size Shopify has.`,
      external_video: (n: number) =>
        `${plural(n, 'YouTube or Vimeo link', 'YouTube or Vimeo links')}. Add them to a section by their link.`,
      model_3d: (n: number) => `${plural(n, '3D model', '3D models')}, not supported yet.`,
      file_not_ready: (n: number) =>
        `${plural(n, 'file', 'files')} Shopify was still processing. Run the import again later.`,
      storage_unwritable: (n: number) =>
        `${plural(n, 'file', 'files')} not copied because file storage isn’t working. Connect Cloudflare R2 or Amazon S3, then retry.`,
      buy_x_get_y: (n: number) =>
        `${plural(n, '“Buy X get Y” discount', '“Buy X get Y” discounts')}, not supported yet.`,
      app_discount: (n: number) =>
        `${plural(n, 'discount', 'discounts')} made by a Shopify app. Their rules live in that app.`,
      customer_specific: (n: number) =>
        `${plural(n, 'discount', 'discounts')} only for chosen customers or segments.`,
      minimum_quantity: (n: number) =>
        `${plural(n, 'discount needs', 'discounts need')} a minimum number of items. Ours can ask for a minimum amount instead.`,
      variant_specific: (n: number) =>
        `${plural(n, 'discount is', 'discounts are')} on single variants. Ours apply to whole products.`,
      per_item_amount: (n: number) =>
        `${plural(n, 'discount takes', 'discounts take')} an amount off each item. Ours take it off the order once.`,
      shipping_rules: (n: number) =>
        `${plural(n, 'free shipping discount is', 'free shipping discounts are')} limited by country or shipping price.`,
      code_characters: (n: number) =>
        `${plural(n, 'code uses', 'codes use')} characters other than letters, numbers and hyphens. Make a new code for each.`,
      items_not_imported: (n: number) =>
        `${plural(n, 'discount is', 'discounts are')} for products or collections that were not imported.`,
      gift_card_code: (n: number) =>
        `${plural(n, 'gift card has', 'gift cards have')} a new code with the same balance, because Shopify never shares full codes. Open each one in Gift cards and press Resend to email the new code to the customer.`,
      gift_card_no_customer: (n: number) =>
        `${plural(n, 'gift card has', 'gift cards have')} a balance but no customer, so there is no one to give a new code to. They keep working on Shopify.`,
      gift_card_empty: (n: number) =>
        `${plural(n, 'gift card is', 'gift cards are')} used up, disabled or expired.`,
      gift_card_over_limit: (n: number) =>
        `${plural(n, 'gift card holds', 'gift cards hold')} more than ₹2,00,000, the most a gift card can hold here.`,
      gift_card_currency: (n: number) =>
        `${plural(n, 'gift card is', 'gift cards are')} in another currency.`,
      gift_card_used_here: (n: number) =>
        `${plural(n, 'gift card was', 'gift cards were')} already spent in this store, so the balance here was kept.`,
    } satisfies Record<LeftBehindReason, (n: number, detail: string) => string>,
  },
} as const
