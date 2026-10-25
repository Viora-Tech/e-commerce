import { definePlugin } from '@commerce/plugins'
import { sesFactory } from './ses'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const sesPlugin = definePlugin({
  id: 'ses',
  name: 'Amazon SES email',
  version: '0.1.0',
  kind: 'connection',
  category: 'messages',
  company: 'Amazon Web Services',
  description: 'Order emails through Amazon SES.',
  listing: {
    tagline: 'Sends your order emails through your own Amazon SES account.',
    highlights: ['Order emails from your own address', 'Your own sending limits'],
    guide: '/merchant-guide/settings/sender-email',
    worksWith: ['Every order and marketing email the store sends'],
    keywords: ['email', 'aws'],
  },
  access: {
    resources: [
      { resource: 'customers', level: 'read', why: 'Email address, to send order emails' },
      { resource: 'orders', level: 'read', why: 'Items, totals and address shown in the email' },
    ],
    summary: 'sends emails',
    shares: [
      {
        when: 'Sent per email',
        what: 'The shopper’s email address and the email itself (order items, totals, address)',
      },
    ],
  },
  provides: { notifications: [sesFactory] },
  admin: {
    icon: 'Inbox',
    pages: [
      // The app opens on its Connect page; Settings → Notifications links here too.
      { path: '', title: 'Connect email', icon: 'Settings' },
      { path: 'connect', title: 'Connect email', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
