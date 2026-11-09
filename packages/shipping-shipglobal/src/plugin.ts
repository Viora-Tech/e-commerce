import { definePlugin } from '@commerce/plugins'
import { shipglobalFactory } from './factory'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then connects its own
 * ShipGlobal account from the app's Connect page (`/apps/shipglobal/connect`). Exports only:
 * it sits beside a domestic courier in the Shipments workspace and only books parcels going
 * abroad, with live rates, the paid label, tracking and cancel from ShipGlobal's vendor API.
 */
export const shipglobalPlugin = definePlugin({
  id: 'shipglobal',
  name: 'ShipGlobal',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'ShipGlobal',
  description:
    'Ship abroad with ShipGlobal: live rates, export bookings with customs lines, labels and tracking.',
  listing: {
    tagline: 'Ship abroad with ShipGlobal: export bookings and labels from your orders.',
    highlights: [
      'Export bookings with HS codes per item',
      'Labels in the Shipments workspace',
      'Tracking and cancel from the order',
    ],
    guide: '/merchant-guide/apps/international-couriers',
    worksWith: [
      'The Shipments workspace and export orders',
      'HS codes on your products, for customs',
    ],
    keywords: ['international', 'export', 'courier', 'shipglobal'],
  },
  access: {
    resources: [
      {
        resource: 'orders',
        level: 'read-write',
        why: 'Reads orders going abroad to book them; tracking marks them delivered',
      },
      {
        resource: 'shipments',
        level: 'read-write',
        why: 'Creates shipments and stores their labels',
      },
      { resource: 'customers', level: 'read', why: 'Name, phone and address, for the parcel only' },
      {
        resource: 'products',
        level: 'read',
        why: 'Weight, size, SKU, HS code and country of origin, for customs',
      },
    ],
    shares: [
      {
        when: 'Sent per shipment',
        what: 'Ship-to name, address, phone and email, item names, SKUs, prices and HS codes, parcel weight and size, and your IOSS',
      },
    ],
  },
  provides: { shipping: [shipglobalFactory] },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'ShipGlobal', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect ShipGlobal', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
