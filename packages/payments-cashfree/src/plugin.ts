import { definePlugin } from '@commerce/plugins'
import { cashfreeFactory } from './cashfree'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const cashfreePlugin = definePlugin({
  id: 'cashfree',
  name: 'Cashfree',
  version: '0.1.0',
  kind: 'connection',
  category: 'payments',
  company: 'Cashfree Payments',
  description: 'UPI, cards, netbanking, wallets and pay later through Cashfree Checkout.',
  listing: {
    tagline: 'UPI, cards, netbanking, wallets and pay later.',
    highlights: [
      'UPI, cards and netbanking at checkout',
      'Wallets and pay later',
      'Refunds from the order page',
    ],
    guide: '/merchant-guide/money-and-gst/cashfree',
    worksWith: [
      'Checkout, beside COD and your other payment methods',
      'Refunds from the order page',
    ],
    keywords: ['payment gateway', 'upi', 'card'],
  },
  access: {
    resources: [
      { resource: 'orders', level: 'read', why: 'Order number and total, to open the payment' },
      { resource: 'payments', level: 'read-write', why: 'Takes payments and confirms them' },
      { resource: 'refunds', level: 'read-write', why: 'Sends refunds back to the shopper' },
      { resource: 'customers', level: 'read', why: 'Name, email and phone, filled in at checkout' },
    ],
    summary: 'takes payments',
    shares: [
      {
        when: 'Sent per payment',
        what: 'Order number and amount, and the shopper’s name, email and phone',
      },
      { when: 'Sent per refund', what: 'Payment reference and refund amount' },
    ],
  },
  provides: { payments: [cashfreeFactory] },
  admin: {
    icon: 'CreditCard',
    pages: [
      { path: '', title: 'Cashfree', navLabel: 'Overview', icon: 'CreditCard' },
      { path: 'connect', title: 'Connect Cashfree', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
