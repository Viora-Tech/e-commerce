import { definePlugin } from '@commerce/plugins'
import { GROWTHBOOK_ID, growthbookConnection, parseGrowthbookSettings } from './settings'

/**
 * GrowthBook experiments (A/B tests). The storefront reads the store's GrowthBook SDK connection
 * (cached a minute), assigns each shopper who allowed analytics on the server, and draws the
 * sections and Liquid branches of their variant; it records "experiment viewed" and purchases
 * in `experiment_event` for GrowthBook to read through a SQL data source. The app page lists the
 * running experiments through GrowthBook's REST API. Settings live in `store.apps` (no table);
 * the secret API key is encrypted there. GrowthBook itself runs elsewhere (GrowthBook Cloud or
 * a self-hosted server); only its MIT JavaScript SDK is used here, never its enterprise code.
 */
export const growthbookPlugin = definePlugin({
  id: GROWTHBOOK_ID,
  name: 'GrowthBook',
  version: '1.0.0',
  kind: 'connection',
  category: 'marketing',
  company: 'GrowthBook',
  description:
    'A/B test your storefront: show different hero banners and sections to different shoppers and see which sells more.',
  access: {
    resources: [
      { resource: 'store-pages', level: 'read', why: 'Shows each shopper their variant of a page' },
      { resource: 'visits', level: 'read', why: 'Counts who saw each variant and who bought' },
    ],
    summary: 'runs A/B tests',
    shares: [
      {
        when: 'Every minute while a test runs',
        what: 'Nothing: your store downloads your test setup from GrowthBook',
      },
    ],
  },
  setupState: (raw) => ({
    connected: growthbookConnection(parseGrowthbookSettings(raw)) !== null,
    problem: null,
  }),
  provides: {},
  credits: [
    {
      name: 'GrowthBook',
      url: 'https://github.com/growthbook/growthbook',
      license: 'MIT',
      note: 'Experiments: its JavaScript SDK assigns shoppers; its REST API lists experiments',
    },
  ],
  admin: {
    icon: 'BarChart3',
    pages: [{ path: '', title: 'Experiments', navLabel: 'Experiments', icon: 'BarChart3' }],
  },
})
