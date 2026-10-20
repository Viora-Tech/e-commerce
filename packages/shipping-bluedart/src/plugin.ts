import { definePlugin } from '@commerce/plugins'
import { bluedartFactory } from './bluedart'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then connects its own
 * Blue Dart API Gateway keys from the app's Connect page (`/apps/bluedart/connect`). Works
 * alongside any other courier in the shared Shipments workspace (Orders -> Shipments).
 */
export const bluedartPlugin = definePlugin({
  id: 'bluedart',
  name: 'Blue Dart',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'Blue Dart',
  description:
    'Serviceability, waybills with labels, pickups, tracking and cancellation on your Blue Dart account.',
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
      { resource: 'products', level: 'read', why: 'Weight, for the waybill' },
    ],
    shares: [
      {
        when: 'Sent per shipment',
        what: 'Ship-to name, address and phone, item names and values, parcel weight and the cash to collect on COD',
      },
    ],
  },
  provides: { shipping: [bluedartFactory] },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'Blue Dart', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect Blue Dart', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
