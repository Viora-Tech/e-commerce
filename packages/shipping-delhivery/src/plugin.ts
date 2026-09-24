import { definePlugin } from '@commerce/plugins'
import { delhiveryFactory } from './delhivery'

/**
 * Listed in commerce.config.ts; a store installs it from Admin → Apps, then
 * connects its own account from the app's own Connect page (`/apps/delhivery/connect`)
 * rather than Settings → Shipping, which now only holds zones and rates. The
 * shared Shipments workspace (Orders → Shipments) works with this and any
 * other courier that registers a `shipping` factory the same way.
 */
export const delhiveryPlugin = definePlugin({
  id: 'delhivery',
  name: 'Delhivery',
  version: '0.2.0',
  category: 'shipping',
  description:
    'Serviceability, delivery estimates, waybills, pickups, tracking and NDR on your Delhivery account.',
  provides: { shipping: [delhiveryFactory] },
  admin: {
    icon: 'Truck',
    pages: [
      { path: '', title: 'Delhivery', navLabel: 'Overview', icon: 'Truck' },
      { path: 'connect', title: 'Connect Delhivery', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
