import { definePlugin } from '@commerce/plugins'
import { deliveryCheckerBlocks } from './blocks'
import { xpressbeesFactory } from './xpressbees'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then connects its own
 * account from the app's Connect page (`/apps/xpressbees/connect`). Works alongside every other
 * courier app in the shared Shipments workspace (Orders -> Shipments).
 */
export const xpressbeesPlugin = definePlugin({
  id: 'xpressbees',
  name: 'Xpressbees',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'Xpressbees (Busybees Logistics)',
  description:
    'Xpressbees Surface, Air and same-day rates, bookings with auto pickup, tracking, cancellation and NDR.',
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
  provides: { shipping: [xpressbeesFactory] },
  storefront: { blocks: deliveryCheckerBlocks },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'Xpressbees', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect Xpressbees', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
