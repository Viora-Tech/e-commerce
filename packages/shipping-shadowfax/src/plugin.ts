import { definePlugin } from '@commerce/plugins'
import { deliveryCheckerBlocks } from './blocks'
import { shadowfaxFactory } from './shadowfax'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then connects its own
 * account from the app's Connect page (`/apps/shadowfax/connect`). Works alongside every other
 * courier app in the shared Shipments workspace (Orders -> Shipments).
 */
export const shadowfaxPlugin = definePlugin({
  id: 'shadowfax',
  name: 'Shadowfax',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'Shadowfax Technologies',
  description: 'Shadowfax forward and reverse bookings, labels, tracking, cancellation and NDR.',
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
  provides: { shipping: [shadowfaxFactory] },
  storefront: { blocks: deliveryCheckerBlocks },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'Shadowfax', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect Shadowfax', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
