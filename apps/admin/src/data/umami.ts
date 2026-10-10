/** Copy for the Umami app's settings page and the Analytics page's visitor section. Plain words. */
export const umamiContent = {
  title: 'Umami',
  subtitle: 'See who visits your store: visitors, top pages, where they came from and more.',
  save: 'Save',
  saved: 'Saved',
  failed: 'Could not save. Try again.',
  status: {
    reporting: 'Counting visitors. Their numbers show on the Analytics page.',
    tracking:
      'Counting visitors. Add an API key so the Analytics page can show their numbers here.',
    notSetUp: 'Not set up yet. Add your Umami address and website below.',
    analyticsLink: 'Open Analytics',
  },
  connect: {
    title: 'Connect Umami',
    description:
      'Umami is a free, open-source analytics tool that sets no cookies. Use Umami Cloud or your own Umami server.',
    url: {
      label: 'Umami address',
      help: 'Where your Umami opens, for example https://analytics.yourstore.in. Using Umami Cloud? Type cloud.umami.is.',
      placeholder: 'https://analytics.yourstore.in',
    },
    apiKey: {
      label: 'API key',
      help: 'Lets this page read your numbers. In Umami: Settings → API keys → Create key. Umami Cloud: Settings → API keys.',
      placeholder: 'Paste the key',
      saved: 'A key is saved. Paste a new one to replace it.',
      remove: 'Remove key',
      removed: 'API key removed',
    },
    websiteId: {
      label: 'Website id',
      help: 'In Umami, open your website’s settings and copy its Website ID. Or let us create the website for you.',
      placeholder: '4f1e2a7c-9b3d-4c5e-8f60-1a2b3c4d5e6f',
      create: 'Create a website for this store',
      created: 'Website created in Umami',
      createNeeds: 'Add the Umami address and an API key first.',
    },
    test: 'Test connection',
    testOk: (name: string) => `Connected to “${name}” in Umami`,
  },
  privacy: {
    title: 'Privacy',
    label: 'Wait for cookie consent',
    help: 'On: visitors are counted only after they allow analytics on your cookie banner. Off: Umami sets no cookies, so visitors are counted until they say no.',
  },
  credit: 'Umami is open source (MIT licence), made by Umami Software.',
  visitors: {
    title: 'Visitors',
    intro: 'From Umami: people who opened your store, the pages they saw and where they came from.',
    open: 'Open in Umami',
    trend: {
      title: 'Visitors over time',
      visitors: 'Visitors',
      pageviews: 'Page views',
      count: 'Count',
      subtitle: (visitors: string, span: string) => `${visitors} visitors ${span}`,
    },
    kpis: {
      visitors: 'Visitors',
      visits: 'Visits',
      pageviews: 'Page views',
      bounceRate: 'Left after one page',
      visitDuration: 'Average visit',
    },
    lists: {
      pages: { title: 'Top pages', empty: 'No page views yet.', none: '(unknown page)' },
      referrers: {
        title: 'Where visitors came from',
        empty: 'No visits yet.',
        none: 'Direct or unknown',
      },
      campaigns: {
        title: 'Campaigns (UTM)',
        empty: 'No visits from tagged links yet. Add ?utm_campaign=… to your ad and post links.',
        none: 'No campaign',
      },
      devices: { title: 'Devices', empty: 'No visits yet.', none: 'Unknown' },
      browsers: { title: 'Browsers', empty: 'No visits yet.', none: 'Unknown' },
      countries: { title: 'Countries', empty: 'No visits yet.', none: 'Unknown' },
    },
    devices: {
      desktop: 'Desktop',
      laptop: 'Laptop',
      mobile: 'Phone',
      tablet: 'Tablet',
    } as Record<string, string>,
    empty: {
      notInstalled: {
        title: 'See who visits your store',
        body: 'Connect Umami, a free analytics tool that sets no cookies, to see visitors, top pages, where they came from, campaigns, devices and countries here.',
        action: 'Get Umami',
      },
      notConnected: {
        title: 'Finish connecting Umami',
        body: 'Add your Umami address, website and an API key, and visitor numbers show up here.',
        action: 'Connect Umami',
      },
      error: { title: 'Could not load visitor numbers', action: 'Check Umami settings' },
    },
    loading: 'Loading visitor numbers…',
    seconds: (s: number) =>
      s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`,
  },
} as const
