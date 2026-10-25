/** SOURCE OF TRUTH: the COD & RTO app manifest — WHAT: the built-in, free "COD & RTO" app (listing, access, admin pages, the order page card) / WHY: the App Store catalogue, Installed apps and the admin sidebar read apps from manifests; the engine is core (`packages/core/src/cod-rto/`) because it runs inside checkout's `placeOrder`, the notifications worker and the returns flow, which a plugin hook cannot reach. Free on every plan because it is absent from `APP_PRICING`. Imported by commerce.config.ts. */
import { definePlugin } from '@commerce/plugins'
import { COD_RTO_APP_ID } from './settings'

/**
 * COD & RTO: fewer parcels coming back. Cash on delivery shoppers confirm their order from a
 * WhatsApp or email link, every order gets an RTO risk score from the store's own history,
 * and the store can refuse COD for high-risk orders.
 */
export const codRtoPlugin = definePlugin({
  id: COD_RTO_APP_ID,
  name: 'COD & RTO',
  version: '1.0.0',
  kind: 'builtin',
  category: 'operations',
  description:
    'Cut cash on delivery losses: shoppers confirm COD orders from a link, every order gets an RTO risk score, and you can turn COD off for risky ones.',
  listing: {
    tagline: 'Confirm COD orders and see which parcels are likely to come back.',
    highlights: [
      'A confirm or cancel link on WhatsApp (or email) after every cash on delivery order',
      'Unanswered orders are flagged for a call; cancelling them for you is optional',
      'An RTO risk score on every order from your own PIN code and customer history',
      'Turn cash on delivery off for high-risk orders at checkout',
      'RTO rate for COD and prepaid, and the PIN codes that send most parcels back',
    ],
    guide: '/merchant-guide/apps/cod-rto',
    worksWith: [
      'Cash on delivery at checkout',
      'Your WhatsApp or email channel for the confirmation message',
      'Returns & RTO in Orders',
    ],
    keywords: ['cod', 'rto', 'cash on delivery', 'cod verification', 'return to origin', 'fraud'],
  },
  access: {
    resources: [
      {
        resource: 'orders',
        level: 'read-write',
        why: 'Scores orders, tags risky ones and records the COD answer',
      },
      { resource: 'customers', level: 'read', why: 'Reads a shopper’s past orders and RTOs' },
      {
        resource: 'order-events',
        level: 'read',
        why: 'Sends the confirmation when a COD order is placed',
      },
    ],
    summary: 'confirms COD orders and scores RTO risk',
  },
  provides: {},
  admin: {
    icon: 'Truck',
    orderDetailCard: true,
    pages: [
      { path: '', title: 'COD & RTO overview', navLabel: 'Overview', icon: 'BarChart3' },
      { path: 'orders', title: 'Risky orders', navLabel: 'Risky orders', icon: 'FileText' },
      {
        path: 'returns',
        title: 'Return reasons',
        navLabel: 'Return reasons',
        icon: 'FileBarChart',
      },
      { path: 'settings', title: 'Settings', navLabel: 'Settings', icon: 'Settings' },
    ],
  },
})
