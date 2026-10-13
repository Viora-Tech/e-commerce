import { SEARCH_CONSOLE_APP_ID, SEARCH_CONSOLE_SYNC_JOB } from '@commerce/core/search-console'
import { definePlugin } from '@commerce/plugins'
import { searchConsoleOAuthApp } from './google'
import { syncSearchConsole } from './server'

/**
 * Google Search Console: the store's Google search numbers (clicks, views, click rate,
 * position) for its pages and the searches that find them, pages almost on page 1, pages and
 * searches losing clicks, and its sitemaps. The numbers also feed the product page's "Google
 * search" card and the SEO report. Each store connects its own Google account (OAuth, the
 * platform's Google client); the refresh token is stored encrypted in `store.apps` and the
 * numbers in `search_console_row`, pulled daily by the worker. No Google code is bundled: the
 * REST APIs are called with `fetch`.
 */
export const searchConsolePlugin = definePlugin({
  id: SEARCH_CONSOLE_APP_ID,
  name: 'Google Search Console',
  version: '1.0.0',
  kind: 'connection',
  category: 'analytics',
  company: 'Google',
  description:
    'See how shoppers find you on Google: the searches, your top pages, pages almost on page 1, pages losing clicks, and your sitemap.',
  provides: {},
  credits: [
    {
      name: 'Google Search Console API',
      url: 'https://developers.google.com/webmaster-tools',
      license: 'Google APIs Terms of Service',
      note: 'Search numbers, properties and sitemaps, read with plain fetch; no Google code bundled',
    },
  ],
  jobs: {
    // The worker queues this once a day per connected store; "Refresh now" runs the same sync.
    [SEARCH_CONSOLE_SYNC_JOB]: async (ctx) => {
      const result = await syncSearchConsole({
        storeId: ctx.storeId,
        inStore: ctx.inStore,
        secret: ctx.settingsSecret,
        app: searchConsoleOAuthApp(process.env),
      })
      if (result.state === 'failed') ctx.log(`sync failed: ${result.message}`)
    },
  },
  admin: {
    icon: 'Search',
    pages: [
      { path: '', title: 'Overview', navLabel: 'Overview', icon: 'BarChart3' },
      { path: 'searches', title: 'Top searches', navLabel: 'Top searches', icon: 'Search' },
      { path: 'pages', title: 'Top pages', navLabel: 'Top pages', icon: 'FileText' },
      {
        path: 'almost-page-one',
        title: 'Almost page 1',
        navLabel: 'Almost page 1',
        icon: 'TrendingUp',
      },
      {
        path: 'losing-traffic',
        title: 'Losing traffic',
        navLabel: 'Losing traffic',
        icon: 'ArrowDown',
      },
      { path: 'sitemaps', title: 'Sitemaps', navLabel: 'Sitemaps', icon: 'ListTree' },
      { path: 'settings', title: 'Settings', navLabel: 'Settings', icon: 'Settings' },
    ],
  },
})
