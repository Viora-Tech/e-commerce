import { definePlugin } from '@commerce/plugins'
import { dhlExpressFactory } from './dhl-express'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then connects its own
 * DHL Express account from the app's Connect page (`/apps/dhl-express/connect`). Exports only:
 * it sits beside a domestic courier in the Shipments workspace and only quotes for parcels
 * going abroad.
 */
export const dhlExpressPlugin = definePlugin({
  id: 'dhl-express',
  name: 'DHL Express',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'DHL',
  description:
    'Ship abroad with DHL Express: rates, labels with the commercial invoice, pickups and tracking.',
  listing: {
    tagline: 'Ship abroad: DHL rates in rupees, labels with the commercial invoice, pickups.',
    highlights: [
      'Export rates and labels',
      'Commercial invoice from your HS codes',
      'Pickups and tracking',
    ],
    guide: '/merchant-guide/apps/international-couriers',
    worksWith: [
      'The Shipments workspace and export orders',
      'HS codes on your products, for the commercial invoice',
    ],
    keywords: ['international', 'export', 'courier'],
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
        why: 'Creates shipments, stores labels and invoices, tracks parcels',
      },
      { resource: 'customers', level: 'read', why: 'Name, phone and address, for the parcel only' },
      {
        resource: 'products',
        level: 'read',
        why: 'Weight, size, HS code and country of origin, for rates and customs',
      },
    ],
    shares: [
      {
        when: 'Sent per shipment',
        what: 'Ship-to name, address and phone, item names, prices, HS codes and origin, parcel weight and size, your GSTIN and IEC',
      },
    ],
  },
  provides: { shipping: [dhlExpressFactory] },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'DHL Express', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect DHL Express', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
