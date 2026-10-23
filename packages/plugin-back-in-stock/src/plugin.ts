import { definePlugin } from '@commerce/plugins'
import { backInStockBlocks } from './blocks'

export const BACK_IN_STOCK_ID = 'back-in-stock'

/**
 * Back-in-stock alerts: a "notify me" signup on a sold-out variant, double
 * opt-in by email, one alert per confirmed signup when the variant restocks,
 * throttled and metered against a free monthly quota. Own code throughout —
 * no open-source app was adopted (see docs/open-source-radar.md).
 */
export const backInStockPlugin = definePlugin({
  id: BACK_IN_STOCK_ID,
  name: 'Back in stock',
  version: '1.0.0',
  kind: 'builtin',
  category: 'marketing',
  description:
    'Let shoppers ask to be notified when a sold-out variant is back, then message everyone waiting the moment it restocks.',
  listing: {
    tagline: 'A "Notify me" button on sold-out products, and an alert when they are back.',
    highlights: [
      'A Notify me block for sold-out products',
      'Emails shoppers the moment stock returns',
      'Signups and how many came back to buy',
    ],
    guide: '/merchant-guide/apps/back-in-stock',
    worksWith: ['Notify me block in your theme', 'The WhatsApp app, for alerts on WhatsApp'],
    keywords: ['restock', 'waitlist', 'notify'],
  },
  access: {
    resources: [
      { resource: 'products', level: 'read', why: 'Sold-out variants, to offer the signup' },
      { resource: 'inventory', level: 'read', why: 'Stock levels, to know when a variant is back' },
      {
        resource: 'customers',
        level: 'read-write',
        why: 'Emails of shoppers who asked to be told',
      },
    ],
    summary: 'sends emails',
  },
  provides: {},
  storefront: { blocks: backInStockBlocks },
  admin: {
    icon: 'Bell',
    pages: [
      { path: '', title: 'Overview', navLabel: 'Overview', icon: 'BarChart3' },
      { path: 'signups', title: 'Signups', navLabel: 'Signups', icon: 'Users' },
      { path: 'settings', title: 'Settings', navLabel: 'Settings', icon: 'Settings' },
    ],
  },
})
