/** Copy for the GrowthBook app's page: the connection, how to test a section, the experiments. */
export const growthbookContent = {
  title: 'GrowthBook',
  subtitle: 'A/B test your store: show different banners and sections to different shoppers.',
  save: 'Save',
  discard: 'Discard',
  unsaved: 'Unsaved changes',
  saved: 'Saved',
  failed: 'Could not save. Try again.',
  status: {
    listing: 'Running. Shoppers who allow analytics are split between your variants.',
    assigning:
      'Running. Shoppers who allow analytics are split between your variants. Add a secret key to see your experiments here.',
    notSetUp: 'Not set up yet. Add your GrowthBook address and client key below.',
    open: 'Open GrowthBook',
  },
  connect: {
    title: 'Connect GrowthBook',
    description:
      'GrowthBook is a free, open-source A/B testing tool. Use GrowthBook Cloud or your own GrowthBook server.',
    apiHost: {
      label: 'API host',
      help: 'Where GrowthBook serves features. GrowthBook Cloud: type cdn.growthbook.io. Your own server: its API address, for example https://growthbook-api.yourstore.in.',
      placeholder: 'cdn.growthbook.io',
    },
    clientKey: {
      label: 'Client key',
      help: 'In GrowthBook: SDK Connections → your connection → Client key. It starts with sdk-.',
      placeholder: 'sdk-AbC123xyz',
    },
    decryptionKey: {
      label: 'Decryption key',
      help: 'Only if the SDK connection encrypts its features. Leave blank otherwise.',
      placeholder: 'Leave blank if not encrypted',
    },
    appUrl: {
      label: 'GrowthBook address',
      help: 'Where you sign in to GrowthBook, for the "Open GrowthBook" links. Not needed for GrowthBook Cloud.',
      placeholder: 'https://growthbook.yourstore.in',
    },
    secretKey: {
      label: 'Secret API key',
      help: 'Optional. Lets this page list your experiments. In GrowthBook: Settings → API keys → New secret key, with the read-only role.',
      placeholder: 'Paste the key',
      saved: 'A key is saved. Paste a new one to replace it.',
      remove: 'Remove key',
      removed: 'Secret key removed',
    },
    test: 'Test connection',
    testOk: (features: number, experiments: number | null) =>
      experiments === null
        ? `Connected: ${features} features found`
        : `Connected: ${features} features and ${experiments} experiments found`,
  },
  howTo: {
    title: 'How to test a section',
    steps: [
      'In GrowthBook, create a feature and add an Experiment rule to it. Copy the experiment’s tracking key, for example hero-test.',
      'In Online store → Customize, add two versions of the section you want to test, for example two hero banners.',
      'On each section, open Advanced → A/B test. Type the tracking key, and 0 (the control) on one section and 1 on the other.',
      'Start the experiment in GrowthBook. Each shopper who allows analytics now sees one version, the same one every visit. Everyone else sees the control.',
    ],
    prices:
      'Prices are never tested: every shopper pays the same price for the same product, as the law and GST invoices expect.',
  },
  experiments: {
    title: 'Experiments',
    description: 'From GrowthBook. Results and decisions stay in GrowthBook.',
    empty: 'No experiments yet. Create one in GrowthBook.',
    noKey: 'Add a secret API key above to see your experiments here.',
    notConnected: 'Connect GrowthBook above to see your experiments here.',
    error: 'Could not load experiments',
    loading: 'Loading experiments…',
    trackingKey: 'Tracking key',
    variations: 'Variants',
    started: (date: string) => `Started ${date}`,
    open: 'Open in GrowthBook',
    status: {
      running: 'Running',
      draft: 'Draft',
      stopped: 'Stopped',
    },
    result: {
      won: 'Won',
      lost: 'Lost',
      dnf: 'Did not finish',
      inconclusive: 'Inconclusive',
    },
  },
  credit: 'GrowthBook is open source (MIT licence), made by GrowthBook, Inc.',
} as const
