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
