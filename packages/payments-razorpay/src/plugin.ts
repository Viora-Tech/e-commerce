import { definePlugin } from '@commerce/plugins'
import { razorpayFactory } from './razorpay'
import { razorpayUpiFactory } from './upi-qr'

/** Listed in commerce.config.ts; a store then installs it from Admin → Apps. */
export const razorpayPlugin = definePlugin({
  id: 'razorpay',
  name: 'Razorpay',
  version: '0.1.0',
  kind: 'connection',
  category: 'payments',
  company: 'Razorpay',
  tested: true,
  description:
    'Cards, UPI, netbanking, wallets and EMI through Razorpay Checkout, plus UPI QR payments confirmed automatically.',
  listing: {
    tagline: 'Cards, UPI and netbanking, with UPI confirmed automatically.',
    highlights: [
      'Cards, UPI, netbanking, wallets and EMI at checkout',
      'A UPI QR per order, confirmed for you',
      'Refunds from the order page',
    ],
    guide: '/merchant-guide/money-and-gst/payments',
    worksWith: [
      'Checkout, beside COD and your other payment methods',
      'Refunds from the order page',
      'The EMI & pay later app',
    ],
    keywords: ['payment gateway', 'upi', 'card', 'emi'],
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
  provides: { payments: [razorpayFactory, razorpayUpiFactory] },
  admin: {
    icon: 'CreditCard',
    pages: [
      { path: '', title: 'Razorpay', navLabel: 'Overview', icon: 'CreditCard' },
      { path: 'connect', title: 'Connect Razorpay', navLabel: 'Connect', icon: 'Settings' },
    ],
  },
})
