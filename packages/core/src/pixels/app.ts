/** SOURCE OF TRUTH: the Pixels app manifest — WHAT: the built-in, free "Pixels" app (Meta Pixel + Conversions API: listing, access, admin pages) / WHY: the App Store catalogue, Installed apps and the admin sidebar read apps from manifests; the engine itself is core (`packages/core/src/pixels/`) because plugin hooks have no storefront script slot and no `order.placed`. Free on every plan (owner, 2026-10-24) because it is absent from `APP_PRICING`. Unlisted until our own pixel has run a week (design §8). Imported by commerce.config.ts. */
import { definePlugin } from '@commerce/plugins'
import { PIXELS_APP_ID } from './jobs'

/**
 * Pixels, Koomerce's "Parkour: Facebook Pixel": several Meta pixels, each event sent from the
 * browser and from our server (Conversions API) with one event ID, gated by marketing consent.
 */
export const pixelsPlugin = definePlugin({
  id: PIXELS_APP_ID,
  name: 'Pixels',
  version: '1.0.0',
  kind: 'builtin',
  category: 'marketing',
  description:
    'Send your visits and sales to Meta from the browser and from our server (Conversions API), so ads still see purchases when browsers block the pixel.',
  listing: {
    tagline: 'Meta Pixel and Conversions API, counted once, like Parkour.',
    highlights: [
      'Several Meta pixels, each with its own events',
      'Every event sent from the browser and our server with one event ID, so Meta counts it once',
      'Purchase when the order is placed, paid or delivered, or prepaid when paid and COD when delivered',
      'Event log with what Meta said, a test event button and an email if a token stops working',
      'Nothing is sent without the shopper’s yes to marketing cookies',
    ],
    guide: '/merchant-guide/apps/pixels',
    worksWith: ['A Meta pixel (dataset) and a Conversions API token from Events Manager'],
    keywords: [
      'facebook pixel',
      'meta pixel',
      'conversions api',
      'capi',
      'parkour',
      'instagram ads',
      'tracking',
    ],
    unlisted: true,
  },
  access: {
    resources: [
      { resource: 'orders', level: 'read', why: 'Sends each purchase to Meta' },
      { resource: 'customers', level: 'read', why: 'Sends hashed email and phone for matching' },
      { resource: 'products', level: 'read', why: 'Sends the products viewed, added and bought' },
    ],
    summary: 'sends your store’s events to Meta',
    shares: [
      {
        when: 'Only for shoppers who said yes to marketing cookies',
        what: 'Pages viewed, products viewed and added, checkouts and purchases with their value, and the shopper’s email, phone, name, city, state and PIN hashed (SHA-256), plus IP address and browser, to Meta',
      },
    ],
  },
  provides: {},
  admin: {
    icon: 'BarChart3',
    pages: [
      { path: '', title: 'Pixels', navLabel: 'Pixels', icon: 'BarChart3' },
      { path: 'events', title: 'Event log', navLabel: 'Event log', icon: 'FileText' },
    ],
  },
})
