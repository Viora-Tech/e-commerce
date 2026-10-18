import { definePlugin } from '@commerce/plugins'
import { whatsappFactory } from './whatsapp'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const whatsappPlugin = definePlugin({
  id: 'whatsapp',
  name: 'WhatsApp',
  version: '0.1.0',
  kind: 'connection',
  category: 'messages',
  company: 'Meta',
  description: 'Order updates on WhatsApp through the Meta Cloud API.',
  access: {
    resources: [
      { resource: 'customers', level: 'read', why: 'Phone number, to send order updates' },
      {
        resource: 'orders',
        level: 'read',
        why: 'Order number, status and tracking link in the message',
      },
    ],
    summary: 'sends messages',
    shares: [
      {
        when: 'Sent per message',
        what: 'The shopper’s phone number and the message’s order details',
      },
    ],
  },
  provides: { notifications: [whatsappFactory] },
  admin: {
    icon: 'MessageSquare',
    pages: [
      // The app opens on its Connect page; Settings → Notifications links here too.
      { path: '', title: 'Connect WhatsApp', icon: 'Settings' },
      { path: 'connect', title: 'Connect WhatsApp', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
