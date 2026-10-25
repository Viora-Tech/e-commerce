import { definePlugin } from '@commerce/plugins'
import { dtdcFactory } from './dtdc'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then connects its own
 * DTDC API key from the app's Connect page (`/apps/dtdc/connect`). Works alongside any other
 * courier in the shared Shipments workspace (Orders -> Shipments).
 */
export const dtdcPlugin = definePlugin({
  id: 'dtdc',
  name: 'DTDC',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'DTDC',
  description:
    'PIN code serviceability, bookings with labels, tracking and cancellation on your DTDC account.',
  listing: {
    tagline: 'DTDC bookings with labels, tracking and cancellation.',
    highlights: ['Pincode serviceability', 'Bookings with labels', 'Tracking and cancellation'],
    guide: '/merchant-guide/apps/couriers',
    worksWith: [
      'The Shipments workspace, beside any other courier you install',
      'Courier rules in Settings → Shipping',
    ],
    keywords: ['courier', 'shipping'],
  },
  access: {
    resources: [
      {
        resource: 'orders',
        level: 'read-write',
        why: 'Reads orders to book consignments; tracking marks them delivered',
      },
      {
        resource: 'shipments',
        level: 'read-write',
        why: 'Creates shipments, prints labels, tracks parcels',
      },
      { resource: 'customers', level: 'read', why: 'Name, phone and address, for the parcel only' },
      { resource: 'products', level: 'read', why: 'Weight, for the booking' },
    ],
    shares: [
      {
        when: 'Sent per shipment',
        what: 'Ship-to name, address and phone, item names, declared value, parcel weight and the cash to collect on COD',
      },
    ],
  },
  provides: { shipping: [dtdcFactory] },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'DTDC', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect DTDC', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
