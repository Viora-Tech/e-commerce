import { definePlugin } from '@commerce/plugins'
import { sesFactory } from './ses'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const sesPlugin = definePlugin({
  id: 'ses',
  name: 'Amazon SES email',
  version: '0.1.0',
  description: 'Order emails through Amazon SES.',
  provides: { notifications: [sesFactory] },
})
