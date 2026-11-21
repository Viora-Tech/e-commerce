import { definePlugin } from '@commerce/plugins'
import { snapmintFactory } from './snapmint'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const snapmintPlugin = definePlugin({
  id: 'snapmint',
  name: 'Snapmint',
  version: '0.1.0',
  kind: 'connection',
  category: 'payments',
  company: 'Snapmint',
  description:
    'Cardless EMI at checkout: shoppers pay in instalments on UPI or a debit card, no credit card needed.',
  listing: {
    tagline: 'EMI on UPI and debit cards, no credit card needed.',
    highlights: [
      'Snapmint as its own way to pay at checkout',
      'Shown only to shoppers Snapmint would approve',
      'Refunds and part refunds from the order page',
    ],
    worksWith: ['Checkout, beside your payment gateway and COD', 'Refunds from the order page'],
    keywords: ['emi', 'cardless emi', 'pay later', 'instalments'],
  },
  access: {
    resources: [
      { resource: 'orders', level: 'read', why: 'Order number, total and items, to open the EMI' },
      { resource: 'payments', level: 'read-write', why: 'Takes payments and confirms them' },
      { resource: 'refunds', level: 'read-write', why: 'Sends refunds back to the shopper' },
      {
        resource: 'customers',
        level: 'read',
        why: 'Name, email, mobile and addresses, which Snapmint needs to approve the EMI',
      },
    ],
    summary: 'takes payments',
    shares: [
      {
        when: 'Sent per payment',
        what: 'Order number, amount and items, and the shopper’s name, email, mobile, addresses and IP address',
      },
      {
        when: 'Sent at checkout',
        what: 'The shopper’s name, email, mobile and delivery address, to ask whether Snapmint can offer EMI',
      },
      { when: 'Sent per refund', what: 'Order reference and refund amount' },
    ],
  },
  provides: { payments: [snapmintFactory] },
  admin: {
    icon: 'CreditCard',
    pages: [
      { path: '', title: 'Snapmint', navLabel: 'Overview', icon: 'CreditCard' },
      { path: 'connect', title: 'Connect Snapmint', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
