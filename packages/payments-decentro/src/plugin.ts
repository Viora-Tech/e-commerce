import { definePlugin } from '@commerce/plugins'
import { decentroFactory } from './decentro'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const decentroPlugin = definePlugin({
  id: 'decentro',
  name: 'Decentro',
  version: '0.1.0',
  kind: 'connection',
  category: 'payments',
  company: 'Decentro',
  description: 'UPI payments by QR code or UPI link, confirmed automatically, with refunds to UPI.',
  listing: {
    tagline: 'UPI by QR code or link, confirmed automatically, with refunds to UPI.',
    highlights: [
      'A UPI QR code or link for each order',
      'Payments confirmed without checking your bank',
      'Refunds straight back to the UPI account',
    ],
    worksWith: [
      'Checkout, beside COD and your other payment methods',
      'Refunds from the order page',
    ],
    keywords: ['upi', 'qr', 'payment'],
  },
  access: {
    resources: [
      { resource: 'orders', level: 'read', why: 'Order number and total, to open the payment' },
      { resource: 'payments', level: 'read-write', why: 'Takes payments and confirms them' },
      { resource: 'refunds', level: 'read-write', why: 'Sends refunds back to the shopper' },
    ],
    summary: 'takes payments',
    shares: [
      { when: 'Sent per payment', what: 'Order reference and amount' },
      { when: 'Sent per refund', what: 'Payment reference and refund amount' },
    ],
  },
  provides: { payments: [decentroFactory] },
  admin: {
    icon: 'CreditCard',
    pages: [
      { path: '', title: 'Decentro', navLabel: 'Overview', icon: 'CreditCard' },
      { path: 'connect', title: 'Connect Decentro', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
