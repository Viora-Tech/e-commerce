import { definePlugin } from '@commerce/plugins'
import { deliveryCheckerBlocks } from './blocks'
import { ekartFactory } from './ekart'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then connects its own
 * account from the app's Connect page (`/apps/ekart/connect`). Works alongside every other
 * courier app in the shared Shipments workspace (Orders -> Shipments).
 */
export const ekartPlugin = definePlugin({
  id: 'ekart',
  name: 'Ekart',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'Ekart Logistics (Flipkart)',
  description:
    'Ekart rates, bookings, returns, tracking, cancellation and NDR on Ekart’s own network.',
  listing: {
    tagline: 'Flipkart’s courier network: rates, bookings, returns and tracking.',
    highlights: ['Rates and delivery days', 'Bookings and return pickups', 'Tracking and NDR'],
    guide: '/merchant-guide/apps/couriers',
    worksWith: [
      'The Shipments workspace, beside any other courier you install',
      'Courier rules in Settings → Shipping',
      'Delivery checker block in your theme',
    ],
    keywords: ['courier', 'shipping', 'flipkart'],
  },
  access: {
    resources: [
      {
        resource: 'orders',
        level: 'read-write',
        why: 'Reads orders to book pickups; tracking marks them delivered',
      },
      {
        resource: 'shipments',
        level: 'read-write',
        why: 'Creates shipments, prints labels, tracks parcels',
      },
      { resource: 'customers', level: 'read', why: 'Name, phone and address, for the parcel only' },
      { resource: 'products', level: 'read', why: 'Weight and size, for courier rates' },
    ],
    shares: [
      {
        when: 'Sent per shipment',
        what: 'Ship-to name, address and phone, item names and prices, parcel weight and the cash to collect on COD',
      },
    ],
  },
  provides: { shipping: [ekartFactory] },
  storefront: { blocks: deliveryCheckerBlocks },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'Ekart', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect Ekart', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
