import { definePlugin } from '@commerce/plugins'
import { deliveryCheckerBlocks } from './blocks'
import { rapidshypFactory } from './rapidshyp'

/**
 * Listed in commerce.config.ts; a store installs it from Admin -> Apps, then
 * connects its own account from the app's own Connect page
 * (`/apps/rapidshyp/connect`). Works alongside Delhivery and Shiprocket (or
 * any other courier plugin) in the shared Shipments workspace (Orders ->
 * Shipments).
 */
export const rapidshypPlugin = definePlugin({
  id: 'rapidshyp',
  name: 'RapidShyp',
  version: '0.1.0',
  kind: 'connection',
  category: 'shipping',
  company: 'RapidShyp',
  description: 'Rate comparison across RapidShyp’s courier network, bookings and cancellation.',
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
  provides: { shipping: [rapidshypFactory] },
  storefront: { blocks: deliveryCheckerBlocks },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'RapidShyp', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect RapidShyp', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
