import { definePlugin } from '@commerce/plugins'
import { delhiveryAppBar } from './app-bar'
import { deliveryCheckerBlocks } from './blocks'
import { delhiveryFactory } from './delhivery'

/**
 * Listed in commerce.config.ts; a store installs it from Admin → Apps, then
 * connects its own account from the app's own Connect page (`/apps/delhivery/connect`)
 * rather than Settings → Shipping, which now only holds zones and rates. The
 * shared Shipments workspace (Orders → Shipments) works with this and any
 * other courier that registers a `shipping` factory the same way.
 */
export const delhiveryPlugin = definePlugin({
  id: 'delhivery',
  name: 'Delhivery',
  version: '0.2.0',
  kind: 'connection',
  category: 'shipping',
  company: 'Delhivery',
  tested: true,
  description:
    'Serviceability, delivery estimates, waybills, pickups, tracking and NDR on your Delhivery account.',
  listing: {
    tagline: 'Rates, labels, pickups and tracking, plus a delivery checker block.',
    highlights: [
      'Live rates and labels',
      'Pickups, tracking updates and NDR',
      'Pincode delivery checker for product pages',
    ],
    guide: '/merchant-guide/orders/shipments',
    worksWith: [
      'The Shipments workspace, beside any other courier you install',
      'Courier rules in Settings → Shipping',
      'Delivery checker block in your theme',
    ],
    keywords: ['courier', 'shipping', 'awb', 'pincode'],
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
        what: 'Ship-to name, address and phone, parcel weight and size, item description and the cash to collect on COD',
      },
    ],
  },
  provides: { shipping: [delhiveryFactory] },
  storefront: { blocks: deliveryCheckerBlocks },
  // The app bar's tracking pill and the parcels in transit on the sidebar's Overview row.
  appBar: (ctx) => delhiveryAppBar(ctx),
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'Delhivery', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect Delhivery', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
