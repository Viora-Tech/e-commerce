import { definePlugin } from '@commerce/plugins'
import { desc, eq } from 'drizzle-orm'
import { backInStockBlocks } from './blocks'
import { backInStockSignup } from './schema'

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
    faq: [
      {
        question: 'Where does the Notify me button show?',
        answer:
          'On product pages, wherever you place the Notify me block in your theme. It shows only while the chosen variant is sold out.',
      },
      {
        question: 'Can I change the alert message?',
        answer:
          'Not yet. The confirm email and the alert use a standard template with your store’s name, the product and a link to buy it. Settings chooses the channels and how fast alerts go out.',
      },
    ],
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
  // The newest backInStockSignup is the app's last use, for the Installed apps list.
  lastUsed: async (tx, storeId) => {
    const [row] = await tx
      .select({ at: backInStockSignup.createdAt })
      .from(backInStockSignup)
      .where(eq(backInStockSignup.storeId, storeId))
      .orderBy(desc(backInStockSignup.createdAt))
      .limit(1)
    return row ? { at: row.at, summary: 'Got a Notify me signup' } : null
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
