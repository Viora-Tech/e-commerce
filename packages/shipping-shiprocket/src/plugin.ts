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
