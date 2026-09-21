import { definePlugin } from '@commerce/plugins'
import { delhiveryFactory } from './delhivery'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const delhiveryPlugin = definePlugin({
  id: 'delhivery',
  name: 'Delhivery',
  version: '0.1.0',
  description:
    'Serviceability, delivery estimates, waybills and tracking on your Delhivery account.',
  provides: { shipping: [delhiveryFactory] },
})
