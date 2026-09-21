import { definePlugin } from '@commerce/plugins'
import { whatsappFactory } from './whatsapp'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const whatsappPlugin = definePlugin({
  id: 'whatsapp',
  name: 'WhatsApp',
  version: '0.1.0',
  description: 'Order updates on WhatsApp through the Meta Cloud API.',
  provides: { notifications: [whatsappFactory] },
})
