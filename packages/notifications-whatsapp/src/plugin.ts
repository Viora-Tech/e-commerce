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
  listing: {
    tagline: 'Order updates on WhatsApp through the Meta Cloud API.',
    highlights: ['Order confirmed, shipped and delivered messages', 'Your own WhatsApp number'],
    guide: '/merchant-guide/settings/notifications',
    worksWith: ['Abandoned cart reminders', 'Back in stock alerts'],
    keywords: ['whatsapp', 'messages', 'meta'],
  },
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
      // Figma 928:11726: Setup (the three steps), the send log, the templates to get approved,
      // and Settings (the account fields). Settings → Notifications links to `connect`.
      { path: '', title: 'WhatsApp setup', navLabel: 'Setup', icon: 'MessageSquare' },
      { path: 'messages', title: 'WhatsApp messages', navLabel: 'Messages', icon: 'MessageSquare' },
      { path: 'templates', title: 'WhatsApp templates', navLabel: 'Templates', icon: 'FileText' },
      { path: 'settings', title: 'WhatsApp settings', navLabel: 'Settings', icon: 'Settings' },
      { path: 'connect', title: 'Connect WhatsApp', icon: 'Settings' },
    ],
  },
})
