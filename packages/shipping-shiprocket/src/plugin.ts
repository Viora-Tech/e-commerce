import { definePlugin } from '@commerce/plugins'
import { deliveryCheckerBlocks } from './blocks'
import { shiprocketFactory } from './shiprocket'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then
 * connects its own account from the app's own Connect page
 * (`/apps/shiprocket/connect`). Works alongside Delhivery (or any other
 * courier plugin) in the shared Shipments workspace (Orders -> Shipments).
 */
export const shiprocketPlugin = definePlugin({
  id: 'shiprocket',
  name: 'Shiprocket',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'Shiprocket',
  description:
    'Rate comparison across Shiprocket’s courier network, bookings, tracking, NDR and wallet balance.',
  listing: {
    tagline: 'Many couriers through one account: rates, labels and tracking.',
    highlights: [
      'Compare courier rates',
      'Bookings, labels and tracking',
      'Wallet balance and NDR',
      'Pincode delivery checker',
    ],
    guide: '/merchant-guide/orders/shipments',
    worksWith: [
      'The Shipments workspace, beside any other courier you install',
      'Courier rules in Settings → Shipping',
      'Delivery checker block in your theme',
    ],
    keywords: ['courier', 'shipping', 'aggregator'],
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
        what: 'Ship-to name, address, phone and email, item names and prices, parcel weight and size and the cash to collect on COD',
      },
    ],
  },
  provides: { shipping: [shiprocketFactory] },
  storefront: { blocks: deliveryCheckerBlocks },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'Shiprocket', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect Shiprocket', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
